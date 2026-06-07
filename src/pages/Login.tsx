import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, LogIn, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const REMEMBERED_EMAIL_KEY = "marbellafisio_remembered_email";

export default function Login() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar email recordado al iniciar
  useEffect(() => {
    const savedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberEmail(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Guardar o eliminar email según preferencia
    if (rememberEmail) {
      localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
    } else {
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        if (authError.message.includes("Invalid login credentials")) {
          setError("Email o contraseña incorrectos");
        } else {
          setError(authError.message);
        }
        return;
      }

      if (data.session) {
        toast({
          title: "Bienvenido/a",
          description: "Has iniciado sesión correctamente.",
        });
        navigate("/");
      }
    } catch (err) {
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = () => {
    setIsLoading(true);
    localStorage.setItem("marbellafisio_demo_mode", "true");
    toast({
      title: "Acceso de Demostración",
      description: "Has iniciado sesión en modo de demostración clínica.",
    });
    setTimeout(() => {
      navigate("/");
      window.location.reload();
    }, 500);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4">
            <Activity className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Marbellafisio</h1>
          <p className="text-muted-foreground">Panel de Control</p>
        </div>

        {/* Login Form */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-foreground mb-6 text-center">
            Iniciar Sesión
          </h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={isLoading}
                  minLength={6}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={rememberEmail}
                onCheckedChange={(checked) => setRememberEmail(checked === true)}
                disabled={isLoading}
              />
              <Label 
                htmlFor="remember" 
                className="text-sm font-normal text-muted-foreground cursor-pointer"
              >
                Recordar mi email
              </Label>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Iniciando sesión...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  Iniciar Sesión
                </span>
              )}
            </Button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">O también</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full border-primary/20 hover:bg-primary/5 text-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
              onClick={handleDemoLogin}
              disabled={isLoading}
            >
              <Activity className="w-4 h-4" />
              Acceso de Demostración (Invitado)
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-6">
            Acceso restringido. Solo usuarios autorizados.
          </p>
        </div>

        {/* Footer */}
        <p className="text-xs text-muted-foreground text-center mt-6">
          © 2026 Marbellafisio. Todos los derechos reservados. (v1.0.1)
        </p>
      </div>
    </div>
  );
}
