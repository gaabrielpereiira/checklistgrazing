import { useState, type FormEvent } from "react";
import { User, Lock, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AnimatedAuthForm = () => {
  const [isActive, setIsActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register state
  const [name, setName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      if (error) throw error;
      toast.success("Login realizado com sucesso!");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: registerEmail,
        password: registerPassword,
        options: { data: { name }, emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      toast.success("Conta criada! Verifique seu email para confirmar.");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');

        .auth-wrapper {
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          background: linear-gradient(90deg, #e2e2e2, #c9d6ff);
          padding: 20px;
          font-family: "Poppins", sans-serif;
        }

        .auth-container {
          position: relative;
          width: 850px;
          max-width: 100%;
          height: 550px;
          background: #fff;
          border-radius: 30px;
          box-shadow: 0 0 30px rgba(0, 0, 0, .2);
          overflow: hidden;
        }

        .auth-container h1 {
          font-size: 36px;
          margin: -10px 0;
          color: #333;
        }

        .auth-container p {
          font-size: 14.5px;
          margin: 15px 0;
          color: #333;
        }

        .auth-form-box {
          position: absolute;
          right: 0;
          width: 50%;
          height: 100%;
          background: #fff;
          display: flex;
          align-items: center;
          color: #333;
          text-align: center;
          padding: 40px;
          z-index: 1;
          transition: .6s ease-in-out 1.2s, visibility 0s 1s;
        }

        .auth-container.active .auth-form-box {
          right: 50%;
        }

        .auth-form-box.register {
          visibility: hidden;
        }

        .auth-container.active .auth-form-box.register {
          visibility: visible;
        }

        .auth-form-inner {
          width: 100%;
        }

        .auth-input-box {
          position: relative;
          margin: 30px 0;
        }

        .auth-input-box input {
          width: 100%;
          padding: 13px 50px 13px 20px;
          background: #eee;
          border-radius: 8px;
          border: none;
          outline: none;
          font-size: 16px;
          color: #333;
          font-weight: 500;
        }

        .auth-input-box input::placeholder {
          color: #888;
          font-weight: 400;
        }

        .auth-input-box .auth-icon {
          position: absolute;
          right: 20px;
          top: 50%;
          transform: translateY(-50%);
          color: #333;
        }

        .auth-forgot-link {
          margin: -15px 0 15px;
        }

        .auth-forgot-link a {
          font-size: 14.5px;
          color: #333;
          text-decoration: none;
        }

        .auth-btn {
          width: 100%;
          height: 48px;
          background: #7494ec;
          border-radius: 8px;
          box-shadow: 0 0 10px rgba(0, 0, 0, .1);
          border: none;
          cursor: pointer;
          font-size: 16px;
          color: #fff;
          font-weight: 600;
          transition: opacity .2s;
        }

        .auth-btn:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        .auth-toggle-box {
          position: absolute;
          width: 100%;
          height: 100%;
        }

        .auth-toggle-box::before {
          content: '';
          position: absolute;
          left: -250%;
          width: 300%;
          height: 100%;
          background: #7494ec;
          border-radius: 150px;
          z-index: 2;
          transition: 1.8s ease-in-out;
        }

        .auth-container.active .auth-toggle-box::before {
          left: 50%;
        }

        .auth-toggle-panel {
          position: absolute;
          width: 50%;
          height: 100%;
          color: #fff;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          z-index: 2;
          transition: .6s ease-in-out;
          padding: 0 40px;
        }

        .auth-toggle-panel h1 {
          color: #fff;
        }

        .auth-toggle-panel p {
          color: #fff;
          margin-bottom: 20px;
        }

        .auth-toggle-panel.toggle-left {
          left: 0;
          transition-delay: 1.2s;
        }

        .auth-container.active .auth-toggle-panel.toggle-left {
          left: -50%;
          transition-delay: .6s;
        }

        .auth-toggle-panel.toggle-right {
          right: -50%;
          transition-delay: .6s;
        }

        .auth-container.active .auth-toggle-panel.toggle-right {
          right: 0;
          transition-delay: 1.2s;
        }

        .auth-toggle-panel .auth-btn {
          width: 160px;
          height: 46px;
          background: transparent;
          border: 2px solid #fff;
          box-shadow: none;
        }

        @media screen and (max-width: 650px) {
          .auth-container {
            height: calc(100vh - 40px);
          }

          .auth-form-box {
            bottom: 0;
            width: 100%;
            height: 70%;
          }

          .auth-container.active .auth-form-box {
            right: 0;
            bottom: 30%;
          }

          .auth-toggle-box::before {
            left: 0;
            top: -270%;
            width: 100%;
            height: 300%;
            border-radius: 20vw;
          }

          .auth-container.active .auth-toggle-box::before {
            left: 0;
            top: 70%;
          }

          .auth-container.active .auth-toggle-panel.toggle-left {
            left: 0;
            top: -30%;
          }

          .auth-toggle-panel {
            width: 100%;
            height: 30%;
          }

          .auth-toggle-panel.toggle-left {
            top: 0;
          }

          .auth-toggle-panel.toggle-right {
            right: 0;
            bottom: -30%;
          }

          .auth-container.active .auth-toggle-panel.toggle-right {
            bottom: 0;
          }
        }

        @media screen and (max-width: 400px) {
          .auth-form-box {
            padding: 20px;
          }

          .auth-toggle-panel h1 {
            font-size: 30px;
          }
        }
      `}</style>

      <div className="auth-wrapper">
        <div className={`auth-container ${isActive ? "active" : ""}`}>
          {/* Login Form */}
          <div className="auth-form-box login">
            <form className="auth-form-inner" onSubmit={handleLogin}>
              <h1>Login</h1>
              <div className="auth-input-box">
                <input
                  type="email"
                  placeholder="Email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
                <Mail className="auth-icon" size={20} />
              </div>
              <div className="auth-input-box">
                <input
                  type="password"
                  placeholder="Senha"
                  required
                  minLength={6}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
                <Lock className="auth-icon" size={20} />
              </div>
              <div className="auth-forgot-link">
                <a href="#">Esqueceu a senha?</a>
              </div>
              <button type="submit" className="auth-btn" disabled={submitting}>
                {submitting ? "Carregando..." : "Login"}
              </button>
            </form>
          </div>

          {/* Register Form */}
          <div className="auth-form-box register">
            <form className="auth-form-inner" onSubmit={handleRegister}>
              <h1>Cadastro</h1>
              <div className="auth-input-box">
                <input
                  type="text"
                  placeholder="Nome"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <User className="auth-icon" size={20} />
              </div>
              <div className="auth-input-box">
                <input
                  type="email"
                  placeholder="Email"
                  required
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                />
                <Mail className="auth-icon" size={20} />
              </div>
              <div className="auth-input-box">
                <input
                  type="password"
                  placeholder="Senha"
                  required
                  minLength={6}
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                />
                <Lock className="auth-icon" size={20} />
              </div>
              <button type="submit" className="auth-btn" disabled={submitting}>
                {submitting ? "Carregando..." : "Cadastrar"}
              </button>
            </form>
          </div>

          {/* Toggle Box */}
          <div className="auth-toggle-box">
            <div className="auth-toggle-panel toggle-left">
              <h1>Olá, bem-vindo!</h1>
              <p>Não tem uma conta?</p>
              <button
                type="button"
                className="auth-btn"
                onClick={() => setIsActive(true)}
              >
                Cadastrar
              </button>
            </div>
            <div className="auth-toggle-panel toggle-right">
              <h1>Bem-vindo de volta!</h1>
              <p>Já tem uma conta?</p>
              <button
                type="button"
                className="auth-btn"
                onClick={() => setIsActive(false)}
              >
                Login
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AnimatedAuthForm;
