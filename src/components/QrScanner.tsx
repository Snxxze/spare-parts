import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (text: string) => void;
}

export function QrScanner({ open, onOpenChange, onScan }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!open) return;
    const id = "qr-reader";
    let scanner: Html5Qrcode | null = null;

    // Wait for dialog animation to finish and element to be in DOM
    const timer = setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;

      scanner = new Html5Qrcode(id);
      scannerRef.current = scanner;
      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            onScan(decoded);
            if (scanner) {
              scanner.stop().then(() => scanner?.clear()).catch(() => {});
            }
            onOpenChange(false);
          },
          () => {}
        )
        .catch((e) => console.error(e));
    }, 300);

    return () => {
      clearTimeout(timer);
      if (scanner) {
        scanner.stop().then(() => scanner?.clear()).catch(() => {});
      }
    };
  }, [open, onScan, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>สแกน QR Code อะไหล่</DialogTitle>
        </DialogHeader>
        <div id="qr-reader" className="w-full overflow-hidden rounded-lg bg-black min-h-[300px]" />
      </DialogContent>
    </Dialog>
  );
}
