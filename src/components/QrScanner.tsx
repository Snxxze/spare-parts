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
    const el = document.getElementById(id);
    if (!el) return;
    const scanner = new Html5Qrcode(id);
    scannerRef.current = scanner;
    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          onScan(decoded);
          scanner.stop().then(() => scanner.clear()).catch(() => {});
          onOpenChange(false);
        },
        () => {}
      )
      .catch((e) => console.error(e));
    return () => {
      scanner.stop().then(() => scanner.clear()).catch(() => {});
    };
  }, [open, onScan, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>สแกน QR Code</DialogTitle>
        </DialogHeader>
        <div id="qr-reader" className="w-full" />
      </DialogContent>
    </Dialog>
  );
}
