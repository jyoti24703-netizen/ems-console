import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthProvider";

const Header = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-white text-xl font-bold">
        {user?.role === "admin"
          ? "Admin Dashboard"
          : "Employee Dashboard"}
      </h1>

      <button
        onClick={handleLogout}
        className="bg-red-500 px-4 py-2 rounded text-white"
      >
        Logout
      </button>
    </div>
  );
};

export default Header;








