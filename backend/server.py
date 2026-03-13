import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Literal, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, Header, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from pydantic import BaseModel, ConfigDict, Field
from jose import JWTError, jwt
from starlette.middleware.cors import CORSMiddleware


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 12
password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI(title="ReachAll Prompt Builder API")
api_router = APIRouter(prefix="/api")


class VariableDefinition(BaseModel):
    key: str
    label: str
    placeholder: str = ""
    required: bool = True
    default_value: str = ""
    input_type: Literal["text", "textarea", "select", "multiselect"] = "text"
    options: List[str] = Field(default_factory=list)


class TemplateSubSection(BaseModel):
    id: str
    title: str
    description: str = ""
    template_text: str
    variables: List[VariableDefinition] = Field(default_factory=list)
    enabled_by_default: bool = True


class PromptSectionTemplate(BaseModel):
    id: str
    name: str
    description: str = ""
    template_text: str
    variables: List[VariableDefinition] = Field(default_factory=list)
    subsections: List[TemplateSubSection] = Field(default_factory=list)
    enabled_by_default: bool = True


class TemplateSectionPayload(BaseModel):
    name: str
    description: str = ""
    template_text: str
    variables: List[VariableDefinition] = Field(default_factory=list)
    subsections: List[TemplateSubSection] = Field(default_factory=list)
    enabled_by_default: bool = True


class PromptSubSectionState(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    title: str
    enabled: bool = True
    raw_text: str
    variable_values: Dict[str, str] = Field(default_factory=dict)


class PromptSectionState(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    enabled: bool = True
    raw_text: str
    variable_values: Dict[str, str] = Field(default_factory=dict)
    subsections: List[PromptSubSectionState] = Field(default_factory=list)


class PromptDraftPayload(BaseModel):
    title: str
    customer_name: str = ""
    use_case: str = ""
    sections: List[PromptSectionState]
    compiled_prompt: str = ""


class PromptDraft(PromptDraftPayload):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_by_role: Literal["admin", "editor", "viewer"] = "editor"
    created_by_username: str = ""
    updated_by_username: str = ""


class CompilePromptRequest(BaseModel):
    sections: List[PromptSectionState]


class CompilePromptResponse(BaseModel):
    compiled_prompt: str
    section_snippets: Dict[str, str]


class MessageResponse(BaseModel):
    message: str


class RolesResponse(BaseModel):
    roles: Dict[str, Dict[str, bool]]


class LoginRequest(BaseModel):
    username: str
    password: str


class UserCreateRequest(BaseModel):
    username: str
    full_name: str
    password: str
    role: Literal["admin", "editor", "viewer"]


class UserRoleUpdateRequest(BaseModel):
    role: Literal["admin", "editor", "viewer"]


class UserPublic(BaseModel):
    id: str
    username: str
    full_name: str
    role: Literal["admin", "editor", "viewer"]
    created_at: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class UserActivityItem(BaseModel):
    draft_id: str
    draft_title: str
    customer_name: str
    updated_at: str
    updated_by_role: Literal["admin", "editor", "viewer"]


class UserActivityResponse(BaseModel):
    username: str
    activities: List[UserActivityItem]


ROLE_PERMISSIONS = {
    "admin": {
        "can_manage_templates": True,
        "can_create_prompts": True,
        "can_update_prompts": True,
        "can_delete_prompts": True,
        "can_manage_users": True,
    },
    "editor": {
        "can_manage_templates": False,
        "can_create_prompts": True,
        "can_update_prompts": True,
        "can_delete_prompts": True,
        "can_manage_users": False,
    },
    "viewer": {
        "can_manage_templates": False,
        "can_create_prompts": False,
        "can_update_prompts": False,
        "can_delete_prompts": False,
        "can_manage_users": False,
    },
}


def normalize_role(role_value: Optional[str]) -> str:
    role = (role_value or "viewer").strip().lower()
    return role if role in ROLE_PERMISSIONS else "viewer"


def enforce_role(user_role: str, allowed_roles: List[str]) -> None:
    if user_role not in allowed_roles:
        raise HTTPException(status_code=403, detail="You do not have permission for this action.")


def normalize_username(username: str) -> str:
    return username.strip().lower()


def hash_password(password: str) -> str:
    return password_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return password_context.verify(plain_password, hashed_password)


def create_access_token(username: str, role: str) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS)
    payload = {
        "sub": username,
        "role": role,
        "exp": int(expires_at.timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


async def ensure_default_admin_user() -> None:
    user_count = await db.users.count_documents({})
    if user_count > 0:
        return

    now_iso = datetime.now(timezone.utc).isoformat()
    default_admin = {
        "id": str(uuid.uuid4()),
        "username": "admin",
        "full_name": "ReachAll Admin",
        "password_hash": hash_password("admin123"),
        "role": "admin",
        "created_at": now_iso,
    }
    await db.users.insert_one(default_admin)


async def get_current_user_from_authorization(authorization: Optional[str]) -> UserPublic:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized.")

    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token.") from exc

    username = normalize_username(payload.get("sub", ""))
    if not username:
        raise HTTPException(status_code=401, detail="Invalid token payload.")

    user_doc = await db.users.find_one({"username": username}, {"_id": 0, "password_hash": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found.")

    return UserPublic(**user_doc)


def get_default_templates() -> List[PromptSectionTemplate]:
    return [
        PromptSectionTemplate(
            id="agent_persona",
            name="Agent Persona",
            description="Defines who the agent is and why it is calling.",
            template_text=(
                "# Agent Persona\n"
                "## Name = {agent_name}\n"
                "## Role = {agent_role}\n"
                "## Gender = {agent_gender}\n"
                "## Objective = {agent_objective}"
            ),
            variables=[
                VariableDefinition(key="agent_name", label="Agent Name", placeholder="Riya", required=True),
                VariableDefinition(
                    key="agent_role",
                    label="Agent Role",
                    placeholder="AI HR Executive for 3eco",
                    required=True,
                ),
                VariableDefinition(
                    key="agent_gender",
                    label="Gender",
                    required=True,
                    input_type="select",
                    options=["female", "male", "neutral"],
                    default_value="female",
                ),
                VariableDefinition(
                    key="agent_objective",
                    label="Agent Objective",
                    placeholder="Notify supervisors about missed checklist.",
                    required=True,
                ),
            ],
            subsections=[
                TemplateSubSection(
                    id="company_details",
                    title="Company Details",
                    description="Optional company context subsection.",
                    template_text=(
                        "### Company Details\n"
                        "Company Name: {company_name}\n"
                        "Company Context: {company_context}\n"
                        "Business Outcome: {company_business_outcome}"
                    ),
                    variables=[
                        VariableDefinition(
                            key="company_name",
                            label="Company Name",
                            placeholder="3eco",
                            required=False,
                        ),
                        VariableDefinition(
                            key="company_context",
                            label="Company Context",
                            placeholder="Fleet operations compliance workflows.",
                            required=False,
                            input_type="textarea",
                        ),
                        VariableDefinition(
                            key="company_business_outcome",
                            label="Business Outcome",
                            placeholder="Reduce missed checklist incidents and penalties.",
                            required=False,
                            input_type="textarea",
                        ),
                    ],
                    enabled_by_default=False,
                )
            ],
        ),
        PromptSectionTemplate(
            id="language_guidelines",
            name="Language Detection & Consistency",
            description="Keeps language behavior stable through the full call.",
            template_text=(
                "## Language Detection & Consistency\n"
                "**CRITICAL: Maintain language consistency throughout the conversation.**\n"
                "If no subsection is selected, follow this supported-language policy: {default_supported_policy}"
            ),
            variables=[
                VariableDefinition(
                    key="default_supported_policy",
                    label="Default Supported Policy",
                    placeholder="Continue in language defined in call flow unless explicit switch request.",
                    required=True,
                    default_value="Continue in the language established by call flow unless the user explicitly asks to switch.",
                    input_type="textarea",
                ),
            ],
            subsections=[
                TemplateSubSection(
                    id="supported_languages",
                    title="Supported Languages",
                    description="Choose supported languages and edit default explanations.",
                    template_text=(
                        "### Supported Languages\n"
                        "Configured supported languages: {supported_languages}\n"
                        "- English: {english_language_explanation}\n"
                        "- Hindi/Hinglish: {hindi_language_explanation}\n"
                        "- Tamil/Tanglish: {tamil_language_explanation}"
                    ),
                    variables=[
                        VariableDefinition(
                            key="supported_languages",
                            label="Supported Languages",
                            required=True,
                            input_type="multiselect",
                            options=["English", "Hindi/Hinglish", "Tamil/Tanglish"],
                            default_value="English, Hindi/Hinglish",
                        ),
                        VariableDefinition(
                            key="english_language_explanation",
                            label="English Explanation",
                            placeholder="Switch to English for complete English sentence structures.",
                            required=False,
                            input_type="textarea",
                            default_value="Use English when user communicates in full English sentence structure.",
                        ),
                        VariableDefinition(
                            key="hindi_language_explanation",
                            label="Hindi/Hinglish Explanation",
                            placeholder="Maintain Hindi/Hinglish when grammar is Hindi dominant.",
                            required=False,
                            input_type="textarea",
                            default_value="Default to Hindi/Hinglish when sentence grammar is Hindi dominant.",
                        ),
                        VariableDefinition(
                            key="tamil_language_explanation",
                            label="Tamil/Tanglish Explanation",
                            placeholder="Switch to Tanglish for Tamil-native user requests.",
                            required=False,
                            input_type="textarea",
                            default_value="Use Tanglish only when user clearly communicates in Tamil-native style.",
                        ),
                    ],
                ),
                TemplateSubSection(
                    id="switching_between_languages",
                    title="Switching Between Languages",
                    description="Define trigger mode for language switch.",
                    template_text=(
                        "### Switching Between Languages\n"
                        "Switch trigger mode: {switch_trigger_mode}\n"
                        "Ask language preference in call flow: {ask_language_preference_in_flow}"
                    ),
                    variables=[
                        VariableDefinition(
                            key="switch_trigger_mode",
                            label="Switch Trigger Mode",
                            required=True,
                            input_type="select",
                            options=["Based on user language", "Based on explicit request only"],
                            default_value="Based on explicit request only",
                        ),
                        VariableDefinition(
                            key="ask_language_preference_in_flow",
                            label="Ask Language Preference in Call Flow",
                            required=False,
                            input_type="select",
                            options=["ON", "OFF"],
                            default_value="OFF",
                        ),
                    ],
                ),
                TemplateSubSection(
                    id="unsupported_language_switch",
                    title="Handling Unsupported Language Switch Requests",
                    description="Define fallback when user asks unsupported language.",
                    template_text=(
                        "### Handling Unsupported Language Switch Requests\n"
                        "Fallback policy: {unsupported_language_switch_policy}"
                    ),
                    variables=[
                        VariableDefinition(
                            key="unsupported_language_switch_policy",
                            label="Unsupported Language Policy",
                            placeholder="Politely acknowledge and continue in nearest supported language.",
                            required=True,
                            input_type="textarea",
                            default_value="Acknowledge request politely and continue in nearest supported language while offering escalation.",
                        ),
                    ],
                ),
                TemplateSubSection(
                    id="language_switch_samples",
                    title="Samples of Detecting Language Switch",
                    description="Used when switch is explicit-request driven.",
                    template_text=(
                        "### Samples of Detecting Language Switch\n"
                        "Sample 1: {switch_sample_1}\n"
                        "Sample 2: {switch_sample_2}\n"
                        "Sample 3: {switch_sample_3}"
                    ),
                    variables=[
                        VariableDefinition(
                            key="switch_sample_1",
                            label="Switch Sample 1",
                            required=False,
                            input_type="textarea",
                        ),
                        VariableDefinition(
                            key="switch_sample_2",
                            label="Switch Sample 2",
                            required=False,
                            input_type="textarea",
                        ),
                        VariableDefinition(
                            key="switch_sample_3",
                            label="Switch Sample 3",
                            required=False,
                            input_type="textarea",
                        ),
                    ],
                    enabled_by_default=False,
                ),
                TemplateSubSection(
                    id="allow_switch_back",
                    title="Allow Switch Back",
                    description="Switch back control policy.",
                    template_text=(
                        "### Allow Switch Back\n"
                        "Switch back policy: {switch_back_policy}"
                    ),
                    variables=[
                        VariableDefinition(
                            key="switch_back_policy",
                            label="Switch Back Policy",
                            required=True,
                            input_type="select",
                            options=["Only when explicitly asked"],
                            default_value="Only when explicitly asked",
                        ),
                    ],
                ),
            ],
        ),
        PromptSectionTemplate(
            id="call_flow",
            name="Call Flow",
            description="Step-by-step conversation sequence.",
            template_text=(
                "## Call Flow Summary\n"
                "Flow objective: {flow_objective}\n"
                "Success criteria: {success_criteria}"
            ),
            variables=[
                VariableDefinition(
                    key="flow_objective",
                    label="Flow Objective",
                    placeholder="Complete checklist reminder in one call.",
                    required=True,
                ),
                VariableDefinition(
                    key="success_criteria",
                    label="Success Criteria",
                    placeholder="Supervisor confirms checklist completion timeline.",
                    required=True,
                ),
            ],
            subsections=[
                TemplateSubSection(
                    id="opening",
                    title="Opening",
                    description="How the call starts.",
                    template_text="### Step 1 - Opening\nGreeting script: {opening_script}",
                    variables=[
                        VariableDefinition(
                            key="opening_script",
                            label="Opening Script",
                            placeholder="Hi {customer_name}, this is {agent_name} from ReachAll.",
                            required=True,
                        )
                    ],
                ),
                TemplateSubSection(
                    id="resolution",
                    title="Resolution & CTA",
                    description="Final action and closure.",
                    template_text="### Step 2 - Resolution\nCall to action: {call_to_action}",
                    variables=[
                        VariableDefinition(
                            key="call_to_action",
                            label="Call to Action",
                            placeholder="Please complete checklist before 6 PM to avoid penalty.",
                            required=True,
                        )
                    ],
                ),
            ],
        ),
        PromptSectionTemplate(
            id="guardrails",
            name="Guardrails",
            description="Hard boundaries and compliance behavior.",
            template_text=(
                "## Guardrails\n"
                "- Never promise anything outside approved policy.\n"
                "- Sensitive data handling: {sensitive_data_rule}\n"
                "- Escalation condition: {escalation_rule}"
            ),
            variables=[
                VariableDefinition(
                    key="sensitive_data_rule",
                    label="Sensitive Data Rule",
                    placeholder="Do not ask for full government ID numbers.",
                    required=True,
                ),
                VariableDefinition(
                    key="escalation_rule",
                    label="Escalation Rule",
                    placeholder="Escalate when user asks for policy exception.",
                    required=True,
                ),
            ],
            subsections=[],
        ),
    ]


async def ensure_default_templates_seeded() -> None:
    defaults = get_default_templates()
    for template in defaults:
        await db.template_sections.update_one(
            {"id": template.id},
            {"$set": template.model_dump()},
            upsert=True,
        )


def extract_placeholders(template_text: str) -> List[str]:
    keys = re.findall(r"\{\s*([a-zA-Z0-9_.-]+)\s*\}", template_text)
    seen = set()
    ordered = []
    for key in keys:
        if key not in seen:
            seen.add(key)
            ordered.append(key)
    return ordered


def fill_template(template_text: str, variable_values: Dict[str, str]) -> str:
    def replace(match: re.Match) -> str:
        key = match.group(1).strip()
        value = variable_values.get(key, "")
        return value.strip() if value and value.strip() else f"{{{key}}}"

    return re.sub(r"\{\s*([a-zA-Z0-9_.-]+)\s*\}", replace, template_text)


def compile_sections(sections: List[PromptSectionState]) -> CompilePromptResponse:
    parts: List[str] = []
    snippets: Dict[str, str] = {}

    for section in sections:
        if not section.enabled:
            continue

        section_lines: List[str] = []
        main_text = fill_template(section.raw_text, section.variable_values).strip()
        if main_text:
            section_lines.append(main_text)

        for subsection in section.subsections:
            if not subsection.enabled:
                continue
            subsection_text = fill_template(subsection.raw_text, subsection.variable_values).strip()
            if subsection_text:
                section_lines.append(subsection_text)

        if section_lines:
            section_output = "\n\n".join(section_lines).strip()
            snippets[section.id] = section_output
            parts.append(section_output)

    return CompilePromptResponse(compiled_prompt="\n\n".join(parts).strip(), section_snippets=snippets)


@api_router.get("/")
async def root() -> MessageResponse:
    return MessageResponse(message="ReachAll Prompt Builder API")


@api_router.post("/auth/login", response_model=AuthResponse)
async def login_user(payload: LoginRequest) -> AuthResponse:
    await ensure_default_admin_user()
    username = normalize_username(payload.username)
    user_doc = await db.users.find_one({"username": username}, {"_id": 0})

    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    if not verify_password(payload.password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    token = create_access_token(user_doc["username"], user_doc["role"])
    user_public = UserPublic(**{key: value for key, value in user_doc.items() if key != "password_hash"})
    return AuthResponse(access_token=token, user=user_public)


@api_router.get("/auth/me", response_model=UserPublic)
async def get_current_user_profile(authorization: Optional[str] = Header(default=None)) -> UserPublic:
    return await get_current_user_from_authorization(authorization)


@api_router.get("/activity/me", response_model=UserActivityResponse)
async def get_my_activity(authorization: Optional[str] = Header(default=None)) -> UserActivityResponse:
    current_user = await get_current_user_from_authorization(authorization)

    draft_docs = (
        await db.prompt_drafts.find(
            {
                "$or": [
                    {"created_by_username": current_user.username},
                    {"updated_by_username": current_user.username},
                ]
            },
            {
                "_id": 0,
                "id": 1,
                "title": 1,
                "customer_name": 1,
                "updated_at": 1,
                "updated_by_role": 1,
            },
        )
        .sort("updated_at", -1)
        .to_list(25)
    )

    activities = [
        UserActivityItem(
            draft_id=draft.get("id", ""),
            draft_title=draft.get("title", "Untitled Prompt"),
            customer_name=draft.get("customer_name", ""),
            updated_at=draft.get("updated_at", datetime.now(timezone.utc).isoformat()),
            updated_by_role=normalize_role(draft.get("updated_by_role", "editor")),
        )
        for draft in draft_docs
    ]

    return UserActivityResponse(username=current_user.username, activities=activities)


@api_router.get("/users", response_model=List[UserPublic])
async def list_users(authorization: Optional[str] = Header(default=None)) -> List[UserPublic]:
    await ensure_default_admin_user()
    current_user = await get_current_user_from_authorization(authorization)
    enforce_role(current_user.role, ["admin"])

    user_docs = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(200)
    return [UserPublic(**doc) for doc in user_docs]


@api_router.post("/users", response_model=UserPublic)
async def create_user(payload: UserCreateRequest, authorization: Optional[str] = Header(default=None)) -> UserPublic:
    current_user = await get_current_user_from_authorization(authorization)
    enforce_role(current_user.role, ["admin"])

    username = normalize_username(payload.username)
    existing_user = await db.users.find_one({"username": username}, {"_id": 0, "id": 1})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists.")

    now_iso = datetime.now(timezone.utc).isoformat()
    user_doc = {
        "id": str(uuid.uuid4()),
        "username": username,
        "full_name": payload.full_name.strip(),
        "password_hash": hash_password(payload.password),
        "role": payload.role,
        "created_at": now_iso,
    }
    await db.users.insert_one(user_doc)

    return UserPublic(**{key: value for key, value in user_doc.items() if key != "password_hash"})


@api_router.put("/users/{user_id}/role", response_model=UserPublic)
async def update_user_role(
    user_id: str,
    payload: UserRoleUpdateRequest,
    authorization: Optional[str] = Header(default=None),
) -> UserPublic:
    current_user = await get_current_user_from_authorization(authorization)
    enforce_role(current_user.role, ["admin"])

    result = await db.users.update_one({"id": user_id}, {"$set": {"role": payload.role}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found.")

    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found.")

    return UserPublic(**user_doc)


@api_router.get("/roles", response_model=RolesResponse)
async def get_roles_matrix(authorization: Optional[str] = Header(default=None)) -> RolesResponse:
    _ = await get_current_user_from_authorization(authorization)
    return RolesResponse(roles=ROLE_PERMISSIONS)


@api_router.get("/templates", response_model=List[PromptSectionTemplate])
async def get_templates(authorization: Optional[str] = Header(default=None)) -> List[PromptSectionTemplate]:
    _ = await get_current_user_from_authorization(authorization)
    await ensure_default_templates_seeded()
    template_docs = await db.template_sections.find({}, {"_id": 0}).to_list(100)

    return [PromptSectionTemplate(**doc) for doc in template_docs]


@api_router.post("/templates", response_model=PromptSectionTemplate)
async def create_template(
    payload: TemplateSectionPayload,
    authorization: Optional[str] = Header(default=None),
) -> PromptSectionTemplate:
    current_user = await get_current_user_from_authorization(authorization)
    enforce_role(current_user.role, ["admin"])

    template = PromptSectionTemplate(id=str(uuid.uuid4()), **payload.model_dump())
    await db.template_sections.insert_one(template.model_dump())
    return template


@api_router.put("/templates/{section_id}", response_model=PromptSectionTemplate)
async def update_template(
    section_id: str,
    payload: TemplateSectionPayload,
    authorization: Optional[str] = Header(default=None),
) -> PromptSectionTemplate:
    current_user = await get_current_user_from_authorization(authorization)
    enforce_role(current_user.role, ["admin"])

    update_doc = payload.model_dump()
    update_doc["id"] = section_id

    result = await db.template_sections.update_one({"id": section_id}, {"$set": update_doc})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Template section not found.")

    template_doc = await db.template_sections.find_one({"id": section_id}, {"_id": 0})
    if not template_doc:
        raise HTTPException(status_code=404, detail="Template section not found.")

    return PromptSectionTemplate(**template_doc)


@api_router.get("/prompts", response_model=List[PromptDraft])
async def list_prompt_drafts(authorization: Optional[str] = Header(default=None)) -> List[PromptDraft]:
    _ = await get_current_user_from_authorization(authorization)
    drafts = await db.prompt_drafts.find({}, {"_id": 0}).sort("updated_at", -1).to_list(300)
    return [PromptDraft(**draft) for draft in drafts]


@api_router.get("/prompts/{draft_id}", response_model=PromptDraft)
async def get_prompt_draft(draft_id: str, authorization: Optional[str] = Header(default=None)) -> PromptDraft:
    _ = await get_current_user_from_authorization(authorization)
    draft_doc = await db.prompt_drafts.find_one({"id": draft_id}, {"_id": 0})
    if not draft_doc:
        raise HTTPException(status_code=404, detail="Prompt draft not found.")
    return PromptDraft(**draft_doc)


@api_router.post("/prompts", response_model=PromptDraft)
async def create_prompt_draft(
    payload: PromptDraftPayload,
    authorization: Optional[str] = Header(default=None),
) -> PromptDraft:
    current_user = await get_current_user_from_authorization(authorization)
    enforce_role(current_user.role, ["admin", "editor"])

    compile_result = compile_sections(payload.sections)
    now_iso = datetime.now(timezone.utc).isoformat()

    draft_data = payload.model_dump()
    draft_data["compiled_prompt"] = payload.compiled_prompt or compile_result.compiled_prompt
    draft_data["created_at"] = now_iso
    draft_data["updated_at"] = now_iso
    draft_data["updated_by_role"] = current_user.role
    draft_data["created_by_username"] = current_user.username
    draft_data["updated_by_username"] = current_user.username

    prompt_draft = PromptDraft(**draft_data)

    await db.prompt_drafts.insert_one(prompt_draft.model_dump())
    return prompt_draft


@api_router.put("/prompts/{draft_id}", response_model=PromptDraft)
async def update_prompt_draft(
    draft_id: str,
    payload: PromptDraftPayload,
    authorization: Optional[str] = Header(default=None),
) -> PromptDraft:
    current_user = await get_current_user_from_authorization(authorization)
    enforce_role(current_user.role, ["admin", "editor"])

    compile_result = compile_sections(payload.sections)
    updated_doc = payload.model_dump()
    updated_doc["compiled_prompt"] = payload.compiled_prompt or compile_result.compiled_prompt
    updated_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    updated_doc["updated_by_role"] = current_user.role
    updated_doc["updated_by_username"] = current_user.username

    result = await db.prompt_drafts.update_one({"id": draft_id}, {"$set": updated_doc})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Prompt draft not found.")

    draft_doc = await db.prompt_drafts.find_one({"id": draft_id}, {"_id": 0})
    if not draft_doc:
        raise HTTPException(status_code=404, detail="Prompt draft not found.")

    return PromptDraft(**draft_doc)


@api_router.delete("/prompts/{draft_id}", response_model=MessageResponse)
async def delete_prompt_draft(
    draft_id: str,
    authorization: Optional[str] = Header(default=None),
) -> MessageResponse:
    current_user = await get_current_user_from_authorization(authorization)
    enforce_role(current_user.role, ["admin", "editor"])

    result = await db.prompt_drafts.delete_one({"id": draft_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Prompt draft not found.")

    return MessageResponse(message="Prompt draft deleted successfully.")


@api_router.post("/prompts/compile", response_model=CompilePromptResponse)
async def compile_prompt(
    payload: CompilePromptRequest,
    authorization: Optional[str] = Header(default=None),
) -> CompilePromptResponse:
    _ = await get_current_user_from_authorization(authorization)
    return compile_sections(payload.sections)


@api_router.get("/templates/{section_id}/variables", response_model=List[str])
async def get_template_variables(section_id: str, authorization: Optional[str] = Header(default=None)) -> List[str]:
    _ = await get_current_user_from_authorization(authorization)
    template_doc = await db.template_sections.find_one({"id": section_id}, {"_id": 0})
    if not template_doc:
        raise HTTPException(status_code=404, detail="Template section not found.")

    keys = extract_placeholders(template_doc.get("template_text", ""))
    for subsection in template_doc.get("subsections", []):
        keys.extend(extract_placeholders(subsection.get("template_text", "")))

    seen = set()
    unique_keys = []
    for key in keys:
        if key not in seen:
            seen.add(key)
            unique_keys.append(key)

    return unique_keys


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup_seed_data() -> None:
    await ensure_default_admin_user()
    await ensure_default_templates_seeded()


@app.on_event("shutdown")
async def shutdown_db_client() -> None:
    client.close()