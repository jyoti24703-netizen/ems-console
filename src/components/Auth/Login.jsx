import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthProvider";

const Login = () => {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [requiresAdminSetup, setRequiresAdminSetup] = useState(false);
  const [allowPublicAdminSignup, setAllowPublicAdminSignup] = useState(false);
  const [adminCount, setAdminCount] = useState(0);
  const [setupLoading, setSetupLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const { setUser } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        const res = await fetch("http://localhost:4000/api/auth/setup-status");
        const data = await res.json();
        const needsSetup = Boolean(data?.requiresAdminSetup);
        setRequiresAdminSetup(needsSetup);
        const publicAdminSignup = Boolean(data?.allowPublicAdminSignup);
        setAllowPublicAdminSignup(publicAdminSignup);
        setAdminCount(Number(data?.adminCount || 0));
        setMode(needsSetup || publicAdminSignup ? "signup" : "login");
      } catch (err) {
        console.error("Failed to fetch setup status:", err);
        setRequiresAdminSetup(false);
        setMode("login");
      } finally {
        setSetupLoading(false);
      }
    };

    checkSetupStatus();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch("http://localhost:4000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Login failed");
        return;
      }

      const userWithToken = {
        ...data.user,
        token: data.token,
      };

      if (!userWithToken.role || !userWithToken.token) {
        alert("Invalid login response from server");
        return;
      }

      localStorage.setItem("token", userWithToken.token);
      localStorage.setItem("user", JSON.stringify(userWithToken));
      setUser(userWithToken);

      if (userWithToken.role === "admin") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/employee", { replace: true });
      }
    } catch (err) {
      console.error(err);
      alert("Server error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleInitialAdminSignup = async (e) => {
    e.preventDefault();

    if (!adminName.trim() || !adminEmail.trim() || !adminPassword.trim()) {
      alert("Name, email, and password are required");
      return;
    }
    if (adminPassword.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }
    if (adminPassword !== confirmPassword) {
      alert("Password and confirm password do not match");
      return;
    }
    setSubmitting(true);

    try {
      const res = await fetch("http://localhost:4000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: adminName.trim(),
          email: adminEmail.trim(),
          password: adminPassword,
          role: "admin",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Admin sign up failed");
        return;
      }

      alert("Admin account created. Please log in.");
      setEmail(adminEmail.trim());
      setPassword("");
      setAdminPassword("");
      setConfirmPassword("");
      setRequiresAdminSetup(false);
      setAdminCount(1);
      setMode("login");
    } catch (err) {
      console.error(err);
      alert("Server error");
    } finally {
      setSubmitting(false);
    }
  };

  if (setupLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f172a] to-black text-gray-300">
        Checking setup status...
      </div>
    );
  }

  const canSelfRegister = true;
  const showSignupForm = mode === "signup" && canSelfRegister;
  const cardTitle = showSignupForm
    ? (requiresAdminSetup ? "Create First Admin" : "Create Admin Account")
    : "Sign In";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,_#102347_0%,_#071126_45%,_#030712_100%)] px-4">
      <div className="w-full max-w-[460px] rounded-2xl border border-[#27324a] bg-[#0f1a30]/95 backdrop-blur-sm shadow-2xl shadow-black/50 p-7">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center px-3 py-1 text-xs font-semibold rounded-full bg-blue-600/20 border border-blue-500/40 text-blue-200">
            EMS Console
          </div>
          <h1 className="text-white text-2xl font-bold mt-3">{cardTitle}</h1>
          <p className="text-sm text-gray-400 mt-1">
            {showSignupForm
              ? (requiresAdminSetup
                ? "Bootstrap your first admin account to initialize the system."
                : "Create an admin account for demo access.")
              : "Sign in with your assigned credentials to continue."}
          </p>
        </div>

        <div className="mb-6 p-1 rounded-xl bg-[#131f35] border border-[#29354e] grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`py-2 rounded-lg text-sm font-semibold transition ${
              mode === "login" ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-[#1b2a46]"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            disabled={!canSelfRegister}
            className={`py-2 rounded-lg text-sm font-semibold transition ${
              mode === "signup" ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-[#1b2a46]"
            } ${!canSelfRegister ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            Sign Up
          </button>
        </div>

        {!canSelfRegister && mode === "signup" && (
          <div className="mb-4 rounded-lg border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Self sign-up is disabled after initial setup. Employees are created by admin from Employee Management.
          </div>
        )}
        {allowPublicAdminSignup && mode === "signup" && (
          <div className="mb-4 rounded-lg border border-blue-600/40 bg-blue-500/10 px-3 py-2 text-xs text-blue-200">
            Demo mode active: additional admin sign-up is enabled publicly.
          </div>
        )}

        {showSignupForm ? (
          <form onSubmit={handleInitialAdminSignup}>
            <input
              type="text"
              placeholder="Admin name"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              className="w-full mb-3 p-3 rounded-lg bg-[#111d33] border border-[#2a3650] text-white outline-none focus:border-blue-500"
              required
            />
            <input
              type="email"
              placeholder="Admin email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              className="w-full mb-3 p-3 rounded-lg bg-[#111d33] border border-[#2a3650] text-white outline-none focus:border-blue-500"
              required
            />
            <input
              type="password"
              placeholder="Create password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="w-full mb-3 p-3 rounded-lg bg-[#111d33] border border-[#2a3650] text-white outline-none focus:border-blue-500"
              minLength={6}
              required
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full mb-5 p-3 rounded-lg bg-[#111d33] border border-[#2a3650] text-white outline-none focus:border-blue-500"
              required
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 py-2.5 rounded-lg text-white font-semibold"
            >
              {submitting ? "Creating..." : "Create Admin Account"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mb-3 p-3 rounded-lg bg-[#111d33] border border-[#2a3650] text-white outline-none focus:border-blue-500"
              required
            />

            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mb-5 p-3 rounded-lg bg-[#111d33] border border-[#2a3650] text-white outline-none focus:border-blue-500"
              required
            />

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 py-2.5 rounded-lg text-white font-semibold"
            >
              {submitting ? "Signing in..." : "Log in"}
            </button>
          </form>
        )}

        <div className="mt-5 text-[11px] text-gray-500 text-center">
          Role-based access and audit trails are enforced across admin and employee workflows.
        </div>
      </div>
    </div>
  );
};

export default Login;

