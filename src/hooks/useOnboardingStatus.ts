import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  isComplete: boolean;
  isRequired: boolean;
}

export interface OnboardingStatus {
  loading: boolean;
  isComplete: boolean;
  currentStep: number;
  steps: OnboardingStep[];
  completionPercentage: number;
  hasSeenWizard: boolean;
  isAdmin: boolean;
  refetch: () => Promise<void>;
  markWizardSeen: () => void;
  resetWizard: () => void;
}

const WIZARD_SEEN_KEY = "taskai_onboarding_wizard_seen";

const INITIAL_STEPS: OnboardingStep[] = [
  { id: "welcome", title: "Boas-vindas", description: "Conheça o TaskAI", isComplete: false, isRequired: false },
  { id: "workspace", title: "Workspace", description: "Nome do seu workspace", isComplete: false, isRequired: true },
  { id: "profile", title: "Perfil", description: "Seu nome e telefone", isComplete: false, isRequired: true },
  { id: "sectors", title: "Setores", description: "Crie ao menos um setor", isComplete: false, isRequired: true },
  { id: "collection", title: "Coleção", description: "Crie sua primeira coleção (board)", isComplete: false, isRequired: true },
  { id: "team", title: "Equipe", description: "Convide colegas (opcional)", isComplete: false, isRequired: false },
  { id: "whatsapp", title: "WhatsApp", description: "Evolution API + QR Code (opcional)", isComplete: false, isRequired: false },
  { id: "slack", title: "Slack", description: "Configure /taskai (opcional)", isComplete: false, isRequired: false },
  { id: "notifications", title: "Notificações", description: "Suas preferências", isComplete: false, isRequired: false },
  { id: "finish", title: "Pronto!", description: "Revise e comece a usar", isComplete: false, isRequired: false },
];

export function useOnboardingStatus(): OnboardingStatus {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [steps, setSteps] = useState<OnboardingStep[]>(INITIAL_STEPS);
  const [hasSeenWizard, setHasSeenWizard] = useState(
    () => localStorage.getItem(WIZARD_SEEN_KEY) === "true"
  );

  const fetchStatus = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      const userIsAdmin = roleData?.role === "admin";
      setIsAdmin(userIsAdmin);

      const workspaceId = profile?.workspace_id;
      const [workspaceRes, sectorsRes, collectionsRes, profilesRes, instancesRes, slackRes] = await Promise.all([
        workspaceId ? supabase.from("workspaces").select("name").eq("id", workspaceId).maybeSingle() : Promise.resolve({ data: null } as any),
        workspaceId ? supabase.from("sectors").select("id").eq("workspace_id", workspaceId).limit(1) : Promise.resolve({ data: [] } as any),
        workspaceId ? supabase.from("collections").select("id").eq("workspace_id", workspaceId).limit(2) : Promise.resolve({ data: [] } as any),
        workspaceId ? supabase.from("profiles").select("id").eq("workspace_id", workspaceId).limit(2) : Promise.resolve({ data: [] } as any),
        supabase.from("whatsapp_instances").select("id, status").eq("is_active", true).limit(5),
        workspaceId ? supabase.from("slack_settings").select("vault_signing_secret_id, is_enabled").eq("workspace_id", workspaceId).maybeSingle() : Promise.resolve({ data: null } as any),
      ]);

      const wsName = (workspaceRes as any)?.data?.name as string | undefined;
      const hasSectors = ((sectorsRes as any)?.data?.length ?? 0) > 0;
      const hasCollections = ((collectionsRes as any)?.data?.length ?? 0) > 0;
      const profileCount = (profilesRes as any)?.data?.length ?? 0;
      const connectedInstance = ((instancesRes as any)?.data ?? []).some((i: any) => i.status === "connected");
      const slack = (slackRes as any)?.data;

      setSteps(prev =>
        prev.map(step => {
          switch (step.id) {
            case "welcome":
              return { ...step, isComplete: hasSeenWizard };
            case "workspace":
              return { ...step, isComplete: !!wsName && wsName !== "Workspace" && wsName !== "Meu Workspace" };
            case "profile":
              return { ...step, isComplete: !!(profile?.name && profile.name.trim().length > 1) };
            case "sectors":
              return { ...step, isComplete: hasSectors };
            case "collection":
              return { ...step, isComplete: hasCollections };
            case "team":
              return { ...step, isComplete: profileCount >= 2 || hasSeenWizard };
            case "whatsapp":
              return { ...step, isComplete: connectedInstance };
            case "slack":
              return { ...step, isComplete: !!(slack?.vault_signing_secret_id && slack?.is_enabled) };
            case "notifications":
              return { ...step, isComplete: profile?.whatsapp_notifications === true || hasSeenWizard };
            case "finish":
              return { ...step, isComplete: hasSeenWizard };
            default:
              return step;
          }
        })
      );
    } catch (error) {
      console.error("[useOnboardingStatus] error:", error);
    } finally {
      setLoading(false);
    }
  }, [user, profile, hasSeenWizard]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const markWizardSeen = useCallback(() => {
    localStorage.setItem(WIZARD_SEEN_KEY, "true");
    setHasSeenWizard(true);
  }, []);

  const resetWizard = useCallback(() => {
    localStorage.removeItem(WIZARD_SEEN_KEY);
    setHasSeenWizard(false);
  }, []);

  const requiredSteps = steps.filter(s => s.isRequired);
  const allRequiredComplete = requiredSteps.every(s => s.isComplete);
  const isComplete = allRequiredComplete && hasSeenWizard;
  const currentStepIndex = steps.findIndex(s => !s.isComplete);
  const completionPercentage = Math.round((steps.filter(s => s.isComplete).length / steps.length) * 100);

  return {
    loading,
    isComplete,
    currentStep: currentStepIndex === -1 ? steps.length - 1 : currentStepIndex,
    steps,
    completionPercentage,
    hasSeenWizard,
    isAdmin,
    refetch: fetchStatus,
    markWizardSeen,
    resetWizard,
  };
}
