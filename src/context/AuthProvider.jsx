import { createContext, useState, useEffect } from "react";

export const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // 🔁 Restore auth on refresh (FIXED – no race condition)
  useEffect(() => {
    let isMounted = true;

    const restoreAuth = () => {
      const storedUser = localStorage.getItem("user");
      const storedToken = localStorage.getItem("token");

      if (storedUser && storedToken && isMounted) {
        setUser(JSON.parse(storedUser));
        setToken(storedToken);
      }

      if (isMounted) {
        setLoading(false);
      }
    };

    restoreAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // 🔐 Login helper
  const login = ({ user, token }) => {
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("token", token);

    setUser(user);
    setToken(token);
  };

  // 🚪 Logout helper
  const logout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");

    setUser(null);
    setToken(null);
  };

  // ⛔ Block app until auth is fully restored
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Restoring session...
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        setUser,
        setToken,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;






















