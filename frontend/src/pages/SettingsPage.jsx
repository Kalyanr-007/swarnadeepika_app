import { useState, useEffect } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { KeyRound, ShieldCheck, Copy, CheckCircle } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SettingsPage = ({ user }) => {
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const [recStatus, setRecStatus] = useState(null);
  const [recPw, setRecPw] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [savingRec, setSavingRec] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");

  useEffect(() => {
    if (user?.username) {
      axios
        .get(`${API}/auth/recovery-status`, { params: { username: user.username } })
        .then((r) => {
          setRecStatus(r.data);
          if (r.data.security_question) setQuestion(r.data.security_question);
        })
        .catch(() => {});
    }
  }, [user]);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPw !== confirmPw) return toast.error("New passwords do not match");
    if (newPw.length < 4) return toast.error("Password must be at least 4 characters");
    setSavingPw(true);
    try {
      await axios.post(`${API}/auth/change-password`, {
        username: user.username,
        current_password: curPw,
        new_password: newPw,
      });
      toast.success("Password changed successfully");
      setCurPw(""); setNewPw(""); setConfirmPw("");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to change password");
    } finally {
      setSavingPw(false);
    }
  };

  const handleSetupRecovery = async (e) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return toast.error("Enter a question and answer");
    setSavingRec(true);
    try {
      const res = await axios.post(`${API}/auth/setup-recovery`, {
        username: user.username,
        current_password: recPw,
        security_question: question,
        security_answer: answer,
      });
      setGeneratedCode(res.data.recovery_code);
      setRecStatus({ has_recovery: true, security_question: question });
      setRecPw(""); setAnswer("");
      toast.success("Recovery set up. Save your recovery code!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to set up recovery");
    } finally {
      setSavingRec(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    toast.success("Recovery code copied");
  };

  return (
    <div className="p-6 max-w-3xl" data-testid="settings-page">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-slate-800">Settings</h1>
        <p className="font-telugu text-slate-500">సెట్టింగ్‌లు</p>
      </div>

      {/* Change Password */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-green-700" /> Change Password
            <span className="font-telugu text-sm text-slate-400">(పాస్‌వర్డ్ మార్చండి)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <Label>Current Password</Label>
              <Input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)}
                data-testid="current-password-input" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>New Password</Label>
                <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
                  data-testid="new-password-input" />
              </div>
              <div>
                <Label>Confirm New Password</Label>
                <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
                  data-testid="confirm-password-input" />
              </div>
            </div>
            <Button type="submit" disabled={savingPw} className="bg-green-700 hover:bg-green-800"
              data-testid="save-password-btn">
              {savingPw ? "Saving..." : "Change Password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Recovery Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-green-700" /> Password Recovery
            <span className="font-telugu text-sm text-slate-400">(రికవరీ)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 mb-4">
            Set a security question and get a recovery code so you can reset your password if you
            forget it. This works fully offline.
            {recStatus?.has_recovery && (
              <span className="ml-1 inline-flex items-center gap-1 text-green-600 font-medium">
                <CheckCircle className="w-4 h-4" /> Recovery is set up
              </span>
            )}
          </p>

          {generatedCode && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg" data-testid="recovery-code-box">
              <p className="text-sm text-amber-800 font-medium mb-2">
                ⚠️ Save this recovery code somewhere safe. It won't be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white px-3 py-2 rounded border font-mono text-lg tracking-wider">
                  {generatedCode}
                </code>
                <Button variant="outline" size="icon" onClick={copyCode} data-testid="copy-recovery-code-btn">
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          <form onSubmit={handleSetupRecovery} className="space-y-4">
            <div>
              <Label>Current Password (to confirm it's you)</Label>
              <Input type="password" value={recPw} onChange={(e) => setRecPw(e.target.value)}
                data-testid="recovery-current-password-input" />
            </div>
            <div>
              <Label>Security Question</Label>
              <Input value={question} onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. What is your village name?" data-testid="security-question-input" />
            </div>
            <div>
              <Label>Answer</Label>
              <Input value={answer} onChange={(e) => setAnswer(e.target.value)}
                placeholder="Your answer" data-testid="security-answer-input" />
            </div>
            <Button type="submit" disabled={savingRec} className="bg-green-700 hover:bg-green-800"
              data-testid="save-recovery-btn">
              {savingRec ? "Saving..." : recStatus?.has_recovery ? "Update Recovery" : "Set Up Recovery"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
