import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { computeChunkPlan, PLATFORM_PER_UPLOAD_CAP } from "@/lib/chunk-plan";
import { formatBytes } from "@/lib/upload-error-messages";
import { Scissors, Cloud, Terminal } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  fileSize?: number | null;
  /** Optional callback so admin can jump to the S3 / External URL tab. */
  onSwitchToExternal?: () => void;
}

/**
 * Modal shown when an upload fails with a 413 (Supabase platform per-upload
 * cap ~50GB). Explains how to split the file into smaller parts and shows a
 * concrete chunk plan up to ~1000GB.
 */
export function SplitFileGuideDialog({ open, onClose, fileSize, onSwitchToExternal }: Props) {
  const cap = PLATFORM_PER_UPLOAD_CAP;
  const examples = [
    100 * 1024 ** 3,
    250 * 1024 ** 3,
    500 * 1024 ** 3,
    1000 * 1024 ** 3,
  ];
  const userPlan = fileSize && fileSize > 0 ? computeChunkPlan(fileSize, cap) : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-4 w-4" /> បំបែកឯកសារធំ (413 — Platform cap)
          </DialogTitle>
          <DialogDescription>
            Supabase Storage កំណត់ទំហំ upload តែម្ដងត្រឹម ~{formatBytes(cap)} ទោះបី
            bucket អនុញ្ញាត 1000GB ក៏ដោយ។ សូមបំបែកឯកសារជា part តូចជាង មុនពេល upload។
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {userPlan && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1">
              <div className="text-[11px] font-semibold text-primary uppercase tracking-wide">
                សម្រាប់ឯកសាររបស់អ្នក
              </div>
              <div className="text-foreground">
                {userPlan.totalLabel} → បំបែកជា{" "}
                <span className="font-bold">{userPlan.parts} part</span> × ~
                <span className="font-bold">{userPlan.partLabel}</span>
              </div>
            </div>
          )}

          <div>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              តារាង chunk size ឧទាហរណ៍ (cap ~{formatBytes(cap)})
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left px-2 py-1.5">ទំហំសរុប</th>
                    <th className="text-left px-2 py-1.5">ចំនួន part</th>
                    <th className="text-left px-2 py-1.5">ទំហំក្នុង 1 part</th>
                  </tr>
                </thead>
                <tbody>
                  {examples.map((b) => {
                    const p = computeChunkPlan(b, cap);
                    return (
                      <tr key={b} className="border-t border-border">
                        <td className="px-2 py-1.5 font-medium">{p.totalLabel}</td>
                        <td className="px-2 py-1.5">{p.parts}</td>
                        <td className="px-2 py-1.5">~{p.partLabel}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <Terminal className="h-3 w-3" /> ឧទាហរណ៍ command (Windows / Mac / Linux)
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-2 font-mono text-[10.5px] leading-relaxed space-y-1">
              <div><span className="text-muted-foreground"># 7-Zip (Windows) — split into 45GB parts</span></div>
              <div>7z a -v45g game.7z game-folder/</div>
              <div className="pt-1"><span className="text-muted-foreground"># macOS / Linux — split a single file</span></div>
              <div>split -b 45G game.zip game.zip.part-</div>
            </div>
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-[11px] text-amber-700 dark:text-amber-300">
            <strong>Tip:</strong> Upload រាល់ part ជា game ដាច់ដោយឡែក
            (Part 1 / Part 2 …) ឬប្ដូរទៅ <strong>AWS S3</strong> / <strong>External URL</strong>{" "}
            ដើម្បីជៀស cap នេះទាំងស្រុង។
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {onSwitchToExternal && (
            <Button type="button" variant="outline" onClick={onSwitchToExternal}>
              <Cloud className="h-3.5 w-3.5 mr-1.5" /> ប្ដូរទៅ S3 / External
            </Button>
          )}
          <Button type="button" onClick={onClose}>យល់ហើយ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
