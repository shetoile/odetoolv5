import { getNAByCode } from "@/lib/naCatalog";
import { getODENodeMetadata } from "@/lib/odePolicy";
import type {
  AppNode,
  ODEChantierMaturityLevel,
  ODEChantierProfile,
  ODEChantierSignoffState,
  ODEChantierStatus
} from "@/lib/types";

export const MANUAL_CHANTIER_PROPERTY = "odeManualChantier";
const CHANTIER_STATUS_PROPERTY = "odeChantierStatus";
const CHANTIER_ACTIVITY_PROPERTY = "odeChantierActivity";
const CHANTIER_QUALITY_TARGET_PROPERTY = "odeChantierQualityTarget";
const CHANTIER_COST_TARGET_PROPERTY = "odeChantierCostTarget";
const CHANTIER_DELAY_TARGET_PROPERTY = "odeChantierDelayTarget";
const CHANTIER_OWNER_PROPERTY = "odeChantierOwner";
const CHANTIER_PLANNING_WINDOW_PROPERTY = "odeChantierPlanningWindow";
const CHANTIER_REVIEW_CADENCE_PROPERTY = "odeChantierReviewCadence";
const CHANTIER_QUARTER_FOCUS_PROPERTY = "odeChantierQuarterFocus";
const CHANTIER_CADENCE_MILESTONES_PROPERTY = "odeChantierCadenceMilestones";
const CHANTIER_CAPACITY_PLAN_PROPERTY = "odeChantierCapacityPlan";
const CHANTIER_DEPENDENCIES_PROPERTY = "odeChantierDependencies";
const CHANTIER_RESOURCES_PROPERTY = "odeChantierResources";
const CHANTIER_ROLE_MODEL_PROPERTY = "odeChantierRoleModel";
const CHANTIER_REQUIRED_SKILLS_PROPERTY = "odeChantierRequiredSkills";
const CHANTIER_PEOPLE_PLAN_PROPERTY = "odeChantierPeoplePlan";
const CHANTIER_INDICATORS_PROPERTY = "odeChantierIndicators";
const CHANTIER_EVIDENCE_PLAN_PROPERTY = "odeChantierEvidencePlan";
const CHANTIER_SIGNOFF_OWNER_PROPERTY = "odeChantierSignoffOwner";
const CHANTIER_SIGNOFF_STATE_PROPERTY = "odeChantierSignoffState";
const CHANTIER_ACCEPTANCE_PLAN_PROPERTY = "odeChantierAcceptancePlan";
const CHANTIER_CLOSURE_PACK_PROPERTY = "odeChantierClosurePack";
const CHANTIER_DECISION_LOG_PROPERTY = "odeChantierDecisionLog";
const CHANTIER_APPROVAL_COMMENT_PROPERTY = "odeChantierApprovalComment";
const CHANTIER_MATURITY_LEVEL_PROPERTY = "odeChantierMaturityLevel";
const CHANTIER_TRANSFORMATION_IMPACT_PROPERTY = "odeChantierTransformationImpact";
const CHANTIER_ADOPTION_NOTES_PROPERTY = "odeChantierAdoptionNotes";
const CHANTIER_CLOSURE_SUMMARY_PROPERTY = "odeChantierClosureSummary";
const CHANTIER_RETEX_PROPERTY = "odeChantierRetex";

function readOptionalText(properties: Record<string, unknown> | undefined, key: string): string | null {
  const value = properties?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeStatus(value: unknown): ODEChantierStatus {
  return value === "proposed" ||
    value === "approved" ||
    value === "active" ||
    value === "paused" ||
    value === "closed" ||
    value === "archived"
    ? value
    : "draft";
}

function normalizeSignoffState(value: unknown): ODEChantierSignoffState | null {
  return value === "in_review" || value === "signed" || value === "not_started" ? value : null;
}

function normalizeMaturityLevel(value: unknown): ODEChantierMaturityLevel | null {
  return value === "emerging" ||
    value === "stabilizing" ||
    value === "scaling" ||
    value === "institutionalized"
    ? value
    : null;
}

export function normalizeChantierProfile(
  profile: Partial<ODEChantierProfile> | ODEChantierProfile | null | undefined
): ODEChantierProfile {
  return {
    status: normalizeStatus(profile?.status),
    activity: normalizeOptionalText(profile?.activity),
    qualityTarget: normalizeOptionalText(profile?.qualityTarget),
    costTarget: normalizeOptionalText(profile?.costTarget),
    delayTarget: normalizeOptionalText(profile?.delayTarget),
    owner: normalizeOptionalText(profile?.owner),
    planningWindow: normalizeOptionalText(profile?.planningWindow),
    reviewCadence: normalizeOptionalText(profile?.reviewCadence),
    quarterFocus: normalizeOptionalText(profile?.quarterFocus),
    cadenceMilestones: normalizeOptionalText(profile?.cadenceMilestones),
    capacityPlan: normalizeOptionalText(profile?.capacityPlan),
    dependencies: normalizeOptionalText(profile?.dependencies),
    resources: normalizeOptionalText(profile?.resources),
    roleModel: normalizeOptionalText(profile?.roleModel),
    requiredSkills: normalizeOptionalText(profile?.requiredSkills),
    peoplePlan: normalizeOptionalText(profile?.peoplePlan),
    indicators: normalizeOptionalText(profile?.indicators),
    evidencePlan: normalizeOptionalText(profile?.evidencePlan),
    signoffOwner: normalizeOptionalText(profile?.signoffOwner),
    signoffState: normalizeSignoffState(profile?.signoffState),
    acceptancePlan: normalizeOptionalText(profile?.acceptancePlan),
    closurePack: normalizeOptionalText(profile?.closurePack),
    decisionLog: normalizeOptionalText(profile?.decisionLog),
    approvalComment: normalizeOptionalText(profile?.approvalComment),
    maturityLevel: normalizeMaturityLevel(profile?.maturityLevel),
    transformationImpact: normalizeOptionalText(profile?.transformationImpact),
    adoptionNotes: normalizeOptionalText(profile?.adoptionNotes),
    closureSummary: normalizeOptionalText(profile?.closureSummary),
    retex: normalizeOptionalText(profile?.retex)
  };
}

export function areChantierProfilesEqual(
  left: Partial<ODEChantierProfile> | ODEChantierProfile | null | undefined,
  right: Partial<ODEChantierProfile> | ODEChantierProfile | null | undefined
): boolean {
  const normalizedLeft = normalizeChantierProfile(left);
  const normalizedRight = normalizeChantierProfile(right);
  return (
    normalizedLeft.status === normalizedRight.status &&
    normalizedLeft.activity === normalizedRight.activity &&
    normalizedLeft.qualityTarget === normalizedRight.qualityTarget &&
    normalizedLeft.costTarget === normalizedRight.costTarget &&
    normalizedLeft.delayTarget === normalizedRight.delayTarget &&
    normalizedLeft.owner === normalizedRight.owner &&
    normalizedLeft.planningWindow === normalizedRight.planningWindow &&
    normalizedLeft.reviewCadence === normalizedRight.reviewCadence &&
    normalizedLeft.quarterFocus === normalizedRight.quarterFocus &&
    normalizedLeft.cadenceMilestones === normalizedRight.cadenceMilestones &&
    normalizedLeft.capacityPlan === normalizedRight.capacityPlan &&
    normalizedLeft.dependencies === normalizedRight.dependencies &&
    normalizedLeft.resources === normalizedRight.resources &&
    normalizedLeft.roleModel === normalizedRight.roleModel &&
    normalizedLeft.requiredSkills === normalizedRight.requiredSkills &&
    normalizedLeft.peoplePlan === normalizedRight.peoplePlan &&
    normalizedLeft.indicators === normalizedRight.indicators &&
    normalizedLeft.evidencePlan === normalizedRight.evidencePlan &&
    normalizedLeft.signoffOwner === normalizedRight.signoffOwner &&
    normalizedLeft.signoffState === normalizedRight.signoffState &&
    normalizedLeft.acceptancePlan === normalizedRight.acceptancePlan &&
    normalizedLeft.closurePack === normalizedRight.closurePack &&
    normalizedLeft.decisionLog === normalizedRight.decisionLog &&
    normalizedLeft.approvalComment === normalizedRight.approvalComment &&
    normalizedLeft.maturityLevel === normalizedRight.maturityLevel &&
    normalizedLeft.transformationImpact === normalizedRight.transformationImpact &&
    normalizedLeft.adoptionNotes === normalizedRight.adoptionNotes &&
    normalizedLeft.closureSummary === normalizedRight.closureSummary &&
    normalizedLeft.retex === normalizedRight.retex
  );
}

export function readChantierProfile(node: AppNode | null | undefined): ODEChantierProfile {
  return normalizeChantierProfile({
    status: normalizeStatus(node?.properties?.[CHANTIER_STATUS_PROPERTY]),
    activity: readOptionalText(node?.properties, CHANTIER_ACTIVITY_PROPERTY),
    qualityTarget: readOptionalText(node?.properties, CHANTIER_QUALITY_TARGET_PROPERTY),
    costTarget: readOptionalText(node?.properties, CHANTIER_COST_TARGET_PROPERTY),
    delayTarget: readOptionalText(node?.properties, CHANTIER_DELAY_TARGET_PROPERTY),
    owner: readOptionalText(node?.properties, CHANTIER_OWNER_PROPERTY),
    planningWindow: readOptionalText(node?.properties, CHANTIER_PLANNING_WINDOW_PROPERTY),
    reviewCadence: readOptionalText(node?.properties, CHANTIER_REVIEW_CADENCE_PROPERTY),
    quarterFocus: readOptionalText(node?.properties, CHANTIER_QUARTER_FOCUS_PROPERTY),
    cadenceMilestones: readOptionalText(node?.properties, CHANTIER_CADENCE_MILESTONES_PROPERTY),
    capacityPlan: readOptionalText(node?.properties, CHANTIER_CAPACITY_PLAN_PROPERTY),
    dependencies: readOptionalText(node?.properties, CHANTIER_DEPENDENCIES_PROPERTY),
    resources: readOptionalText(node?.properties, CHANTIER_RESOURCES_PROPERTY),
    roleModel: readOptionalText(node?.properties, CHANTIER_ROLE_MODEL_PROPERTY),
    requiredSkills: readOptionalText(node?.properties, CHANTIER_REQUIRED_SKILLS_PROPERTY),
    peoplePlan: readOptionalText(node?.properties, CHANTIER_PEOPLE_PLAN_PROPERTY),
    indicators: readOptionalText(node?.properties, CHANTIER_INDICATORS_PROPERTY),
    evidencePlan: readOptionalText(node?.properties, CHANTIER_EVIDENCE_PLAN_PROPERTY),
    signoffOwner: readOptionalText(node?.properties, CHANTIER_SIGNOFF_OWNER_PROPERTY),
    signoffState: normalizeSignoffState(node?.properties?.[CHANTIER_SIGNOFF_STATE_PROPERTY]),
    acceptancePlan: readOptionalText(node?.properties, CHANTIER_ACCEPTANCE_PLAN_PROPERTY),
    closurePack: readOptionalText(node?.properties, CHANTIER_CLOSURE_PACK_PROPERTY),
    decisionLog: readOptionalText(node?.properties, CHANTIER_DECISION_LOG_PROPERTY),
    approvalComment: readOptionalText(node?.properties, CHANTIER_APPROVAL_COMMENT_PROPERTY),
    maturityLevel: normalizeMaturityLevel(node?.properties?.[CHANTIER_MATURITY_LEVEL_PROPERTY]),
    transformationImpact: readOptionalText(node?.properties, CHANTIER_TRANSFORMATION_IMPACT_PROPERTY),
    adoptionNotes: readOptionalText(node?.properties, CHANTIER_ADOPTION_NOTES_PROPERTY),
    closureSummary: readOptionalText(node?.properties, CHANTIER_CLOSURE_SUMMARY_PROPERTY),
    retex: readOptionalText(node?.properties, CHANTIER_RETEX_PROPERTY)
  });
}

export function applyChantierProfileToProperties(
  properties: Record<string, unknown> | undefined,
  profile: Partial<ODEChantierProfile> | ODEChantierProfile | null | undefined
): Record<string, unknown> {
  const nextProperties: Record<string, unknown> = { ...(properties ?? {}) };
  const normalized = normalizeChantierProfile(profile);
  const hasExplicitProfile = profile !== null && profile !== undefined;

  const propertyMap = new Map<string, string | null>([
    [CHANTIER_STATUS_PROPERTY, hasExplicitProfile ? normalized.status : null],
    [CHANTIER_ACTIVITY_PROPERTY, normalized.activity],
    [CHANTIER_QUALITY_TARGET_PROPERTY, normalized.qualityTarget],
    [CHANTIER_COST_TARGET_PROPERTY, normalized.costTarget],
    [CHANTIER_DELAY_TARGET_PROPERTY, normalized.delayTarget],
    [CHANTIER_OWNER_PROPERTY, normalized.owner],
    [CHANTIER_PLANNING_WINDOW_PROPERTY, normalized.planningWindow],
    [CHANTIER_REVIEW_CADENCE_PROPERTY, normalized.reviewCadence],
    [CHANTIER_QUARTER_FOCUS_PROPERTY, normalized.quarterFocus],
    [CHANTIER_CADENCE_MILESTONES_PROPERTY, normalized.cadenceMilestones],
    [CHANTIER_CAPACITY_PLAN_PROPERTY, normalized.capacityPlan],
    [CHANTIER_DEPENDENCIES_PROPERTY, normalized.dependencies],
    [CHANTIER_RESOURCES_PROPERTY, normalized.resources],
    [CHANTIER_ROLE_MODEL_PROPERTY, normalized.roleModel],
    [CHANTIER_REQUIRED_SKILLS_PROPERTY, normalized.requiredSkills],
    [CHANTIER_PEOPLE_PLAN_PROPERTY, normalized.peoplePlan],
    [CHANTIER_INDICATORS_PROPERTY, normalized.indicators],
    [CHANTIER_EVIDENCE_PLAN_PROPERTY, normalized.evidencePlan],
    [CHANTIER_SIGNOFF_OWNER_PROPERTY, normalized.signoffOwner],
    [CHANTIER_SIGNOFF_STATE_PROPERTY, normalized.signoffState],
    [CHANTIER_ACCEPTANCE_PLAN_PROPERTY, normalized.acceptancePlan],
    [CHANTIER_CLOSURE_PACK_PROPERTY, normalized.closurePack],
    [CHANTIER_DECISION_LOG_PROPERTY, normalized.decisionLog],
    [CHANTIER_APPROVAL_COMMENT_PROPERTY, normalized.approvalComment],
    [CHANTIER_MATURITY_LEVEL_PROPERTY, normalized.maturityLevel],
    [CHANTIER_TRANSFORMATION_IMPACT_PROPERTY, normalized.transformationImpact],
    [CHANTIER_ADOPTION_NOTES_PROPERTY, normalized.adoptionNotes],
    [CHANTIER_CLOSURE_SUMMARY_PROPERTY, normalized.closureSummary],
    [CHANTIER_RETEX_PROPERTY, normalized.retex]
  ]);

  for (const [key, value] of propertyMap) {
    if (value) {
      nextProperties[key] = value;
    } else {
      delete nextProperties[key];
    }
  }

  return nextProperties;
}

export function isChantierNode(node: AppNode | null | undefined): boolean {
  return getODENodeMetadata(node).kind === "chantier";
}

export function isManualChantierNode(node: AppNode | null | undefined): boolean {
  return node?.properties?.[MANUAL_CHANTIER_PROPERTY] === true;
}

export function getChantierLinkedNADisplay(node: AppNode | null | undefined): string | null {
  const metadata = getODENodeMetadata(node);
  if (!metadata.naCode) return null;
  const match = getNAByCode(metadata.naCode);
  return match ? `${metadata.naCode} - ${match.label}` : metadata.naCode;
}
