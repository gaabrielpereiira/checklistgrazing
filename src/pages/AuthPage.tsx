import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AnimatedAuthForm from "@/components/AnimatedAuthForm";

export default function AuthPage() {
  const { user, loading: authLoading } = useAuth();

  if (!authLoading && user) return <Navigate to="/" replace />;

  return <AnimatedAuthForm />;
}
