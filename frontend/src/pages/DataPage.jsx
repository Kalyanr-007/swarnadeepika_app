import { useState, useEffect } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Database, Download, ShieldAlert, HardDrive, Archive, FileArchive,
  RotateCcw, Copy, CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const prettySize = (n) => {
  if (!n && n !== 0) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};

const fmt = (d) => { try { return format(new Date(d), "dd MMM yyyy HH:mm"); } catch { return d; } };

const DataPage = ({ user, onLogout }) => {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [pwd, setPwd] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/data/info`);
      setInfo(res.data);
    } catch (e) {
      toast.error("Failed to load data info");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const download = async () => {
    setDownloading(true);
    try {
      const res = await axios.get(`${API}/data/export`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url;
      const ts = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
      a.download = `swarna_deepika_export_${ts}.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded");
      load();
    } catch (e) {
      toast.error("Export failed");
    } finally { setDownloading(false); }
  };

  const downloadServerBackup = async (name) => {
    try {
      const res = await axios.get(`${API}/data/backup/download/${encodeURIComponent(name)}`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { toast.error("Failed to download backup"); }
  };

  const runReset = async () => {
    setResetting(true);
    try {
      const res = await axios.post(`${API}/data/reset-auth`, {
        confirm_phrase: confirmPhrase,
        admin_username: user?.username || "admin",
        admin_password: pwd,
      });
      setResetResult(res.data);
      toast.success("Auth reset complete");
      setConfirmOpen(false);
      setConfirmPhrase(""); setPwd("");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Reset failed");
    } finally { setResetting(false); }
  };

  const copyText = (t) => { navigator.clipboard.writeText(t); toast.success("Copied"); };

  const counts = info?.counts || {};
  const totalRecords = Object.values(counts).reduce((a, b) => a + (b || 0), 0);

  return (
    <div className="p-6" data-testid="data-page">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-slate-800">Data & Backup</h1>
        <p className="font-telugu text-slate-500">డేటా మరియు బ్యాకప్</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-700"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Storage location card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-green-700" /> Where your data lives
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow label="Backend" value={info?.backend === "sqlite" ? "SQLite (offline)" : "MongoDB"} />
              {info?.backend === "sqlite" ? (
                <>
                  <InfoRow label="Database file" value={info?.db_path} copy={info?.db_path} onCopy={copyText} />
                  <InfoRow label="Data folder" value={info?.data_dir} copy={info?.data_dir} onCopy={copyText} />
                </>
              ) : (
                <>
                  <InfoRow label="Mongo URL" value={info?.mongo_url} />
                  <InfoRow label="Database name" value={info?.db_name} />
                </>
              )}
              <InfoRow label="Backup folder" value={info?.backup_dir} copy={info?.backup_dir} onCopy={copyText} />
              <p className="text-xs text-slate-500 pt-2">
                Your data is stored permanently on this machine and survives restarts.
                {info?.backend === "sqlite"
                  ? " Back up the database file by copying it to a USB drive."
                  : " MongoDB persists to disk at /var/lib/mongodb by default."}
              </p>
            </CardContent>
          </Card>

          {/* Counts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="w-5 h-5 text-green-700" /> Stored data ({totalRecords.toLocaleString()} rows)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(counts).map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-slate-200 p-3" data-testid={`count-${k}`}>
                    <p className="text-xs text-slate-500 capitalize">{k.replace(/_/g, " ")}</p>
                    <p className="font-heading text-xl font-bold text-slate-800">{(v || 0).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Export */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Archive className="w-5 h-5 text-green-700" /> Export data (CSV backup)
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4 items-center">
              <Button
                onClick={download} disabled={downloading}
                className="bg-green-700 hover:bg-green-800"
                data-testid="export-download-btn"
              >
                <Download className="w-4 h-4 mr-2" />
                {downloading ? "Preparing..." : "Download ZIP of all data"}
              </Button>
              <p className="text-sm text-slate-500">
                One zip with a CSV for each collection: products, categories, customers, bills,
                loan_payments, expenses, purchases, users (no password hashes).
              </p>
            </CardContent>
          </Card>

          {/* Reset auth */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-red-700">
                <ShieldAlert className="w-5 h-5" /> Reset Login Credentials
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-900">
                <p className="font-semibold mb-2">⚠️ This will:</p>
                <ul className="list-disc ml-5 space-y-1">
                  <li>Delete <b>all user accounts</b> (usernames, password hashes, recovery codes)</li>
                  <li>Re-create the default <code>admin / swarna123</code> login</li>
                </ul>
                <p className="font-semibold mt-3 mb-2 text-green-800">✅ This will NOT delete:</p>
                <ul className="list-disc ml-5 space-y-1 text-green-900">
                  <li>Products, Categories, Stock levels</li>
                  <li>Customers, Bills, Loans, Payments</li>
                  <li>Purchases, Expenses — all business data is preserved</li>
                </ul>
                <p className="mt-3">
                  Before wiping users we automatically save a complete backup ZIP (including users) to disk.
                  You&apos;ll see the exact file path after the reset.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setConfirmOpen(true)}
                className="border-red-300 text-red-700 hover:bg-red-50"
                data-testid="reset-auth-open-btn"
              >
                <RotateCcw className="w-4 h-4 mr-2" /> Reset Login Credentials…
              </Button>
            </CardContent>
          </Card>

          {/* Recent backups */}
          {info?.recent_backups?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileArchive className="w-5 h-5 text-green-700" /> Recent server-side backups
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {info.recent_backups.map((b) => (
                    <div key={b.name}
                      className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2"
                      data-testid={`backup-${b.name}`}
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-800">{b.name}</p>
                        <p className="text-xs text-slate-500">
                          {fmt(b.created_at)} · {prettySize(b.size_bytes)}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => downloadServerBackup(b.name)}>
                        <Download className="w-4 h-4 mr-1" /> Download
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Confirm dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent data-testid="reset-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-700">Reset Login Credentials?</AlertDialogTitle>
            <AlertDialogDescription>
              To confirm, type <code className="bg-slate-100 px-1 rounded">RESET AUTH</code> and re-enter
              your current admin password. Business data is preserved. A backup ZIP is saved on disk first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Type: <b>RESET AUTH</b></Label>
              <Input value={confirmPhrase} onChange={(e) => setConfirmPhrase(e.target.value)}
                placeholder="RESET AUTH" data-testid="reset-phrase-input" />
            </div>
            <div>
              <Label>Current admin password</Label>
              <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)}
                placeholder="••••••••" data-testid="reset-password-input" />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="reset-cancel-btn">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={runReset}
              disabled={resetting || confirmPhrase.trim().toUpperCase() !== "RESET AUTH" || !pwd}
              className="bg-red-600 hover:bg-red-700"
              data-testid="reset-confirm-btn"
            >
              {resetting ? "Working..." : "Backup & Reset"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Result dialog */}
      <AlertDialog open={!!resetResult} onOpenChange={(open) => { if (!open) { setResetResult(null); if (onLogout) onLogout(); } }}>
        <AlertDialogContent data-testid="reset-result-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-5 h-5" /> Auth reset complete
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-slate-700">
                <p>Your business data is safe. A complete backup was saved before the reset.</p>
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2">
                  <div>
                    <p className="text-xs text-slate-500">Backup file location</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs break-all">{resetResult?.backup_file}</code>
                      <Button size="icon" variant="ghost"
                        onClick={() => copyText(resetResult?.backup_file || "")}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">
                    Size: {prettySize(resetResult?.backup_size_bytes)} · Users removed:{" "}
                    {resetResult?.users_deleted}
                  </div>
                </div>
                <p>
                  New default login:{" "}
                  <b>{resetResult?.reseeded_admin?.username}</b> /{" "}
                  <b>{resetResult?.reseeded_admin?.password}</b>
                </p>
                <p className="text-xs text-slate-500">You&apos;ll be logged out when you close this dialog.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => downloadServerBackup(resetResult?.backup_filename)}
              className="bg-green-700 hover:bg-green-800"
            >
              <Download className="w-4 h-4 mr-2" /> Download backup now
            </AlertDialogAction>
            <AlertDialogAction data-testid="reset-close-btn">OK, log me out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const InfoRow = ({ label, value, copy, onCopy }) => (
  <div className="flex items-start justify-between gap-3">
    <div className="min-w-0">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm text-slate-800 break-all font-mono">{value || "-"}</p>
    </div>
    {copy && (
      <Button size="icon" variant="ghost" onClick={() => onCopy(copy)} className="text-slate-400 shrink-0">
        <Copy className="w-3.5 h-3.5" />
      </Button>
    )}
  </div>
);

export default DataPage;
