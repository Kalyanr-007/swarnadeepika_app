import { useState } from "react";
import axios from "axios";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { toast } from "sonner";
import { Store, Eye, EyeOff } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error("Please enter username and password");
      return;
    }

    setLoading(true);
    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const response = await axios.post(`${API}${endpoint}`, {
        username,
        password,
        role: "admin"
      });

      if (isRegister) {
        toast.success("Account created! Please login.");
        setIsRegister(false);
        setPassword("");
      } else {
        toast.success("Login successful!");
        onLogin(response.data.user);
      }
    } catch (error) {
      const message = error.response?.data?.detail || "Authentication failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Image */}
      <div 
        className="hidden lg:flex lg:w-1/2 relative bg-cover bg-center"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=80')`
        }}
      >
        <div className="login-overlay absolute inset-0 flex items-center justify-center p-12">
          <div className="text-white text-center">
            <h1 className="font-telugu text-4xl font-bold mb-2">
              స్వర్ణదీపిక ఫర్టిలైజర్స్
            </h1>
            <h2 className="font-heading text-2xl font-semibold mb-4">
              Swarna Deepika Fertilizers
            </h2>
            <p className="font-telugu text-lg opacity-90">
              పెస్టిసైడ్స్ & సీడ్స్
            </p>
            <p className="text-sm opacity-75 mt-2">
              Pesticides & Seeds
            </p>
            <div className="mt-8 p-4 bg-white/10 rounded-lg backdrop-blur-sm">
              <p className="font-telugu text-sm">
                గ్రా॥ గంగారం, మం॥ కాటారం
              </p>
              <p className="font-telugu text-sm">
                జి॥ జయశంకర్ భూపాలపల్లి
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-slate-50">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 bg-green-700 rounded-2xl flex items-center justify-center mb-4">
              <Store className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="font-heading text-2xl text-slate-800">
              {isRegister ? "Create Account" : "Welcome Back"}
            </CardTitle>
            <p className="text-slate-500 text-sm mt-1">
              {isRegister 
                ? "Register a new account to get started" 
                : "Sign in to access your billing dashboard"}
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-700">
                  Username
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-11"
                  data-testid="login-username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 pr-10"
                    data-testid="login-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                className="w-full h-11 bg-green-700 hover:bg-green-800 font-heading font-semibold"
                disabled={loading}
                data-testid="login-submit"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    {isRegister ? "Creating..." : "Signing in..."}
                  </span>
                ) : (
                  isRegister ? "Create Account" : "Sign In"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setIsRegister(!isRegister)}
                className="text-sm text-green-700 hover:text-green-800 font-medium"
              >
                {isRegister 
                  ? "Already have an account? Sign in" 
                  : "Don't have an account? Register"}
              </button>
            </div>

            {/* Mobile shop info */}
            <div className="lg:hidden mt-8 pt-6 border-t border-slate-200 text-center">
              <p className="font-telugu text-green-800 font-semibold">
                స్వర్ణదీపిక ఫర్టిలైజర్స్, పెస్టిసైడ్స్ & సీడ్స్
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Swarna Deepika Fertilizers, Pesticides & Seeds
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
