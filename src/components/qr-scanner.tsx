"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, CameraOff, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface QrScannerProps {
  onScan: (code: string) => void
  onClose?: () => void
}

export function QrScanner({ onScan, onClose }: QrScannerProps) {
  const containerId = useRef(`qr-reader-${Math.random().toString(36).slice(2)}`)
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null)
  const [error, setError] = useState<string>("")
  const [starting, setStarting] = useState(true)

  useEffect(() => {
    let mounted = true
    let html5Qr: { start: (...a: unknown[]) => Promise<unknown>; stop: () => Promise<unknown>; clear: () => void } | null = null

    async function init() {
      try {
        const mod = await import("html5-qrcode")
        const Html5Qrcode = mod.Html5Qrcode
        html5Qr = new Html5Qrcode(containerId.current)
        scannerRef.current = {
          stop: async () => {
            try {
              await (html5Qr as { stop: () => Promise<unknown> }).stop()
            } catch {
              /* ignore */
            }
          },
          clear: () => {
            try {
              ;(html5Qr as { clear: () => void }).clear()
            } catch {
              /* ignore */
            }
          },
        }
        await (html5Qr as {
          start: (
            config: unknown,
            opts: unknown,
            onSuccess: (t: string) => void,
            onError: (e: unknown) => void
          ) => Promise<unknown>
        }).start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 230, height: 230 } },
          (decoded: string) => {
            if (!mounted) return
            onScan(decoded)
          },
          () => {
            /* per-frame errors ignored */
          }
        )
        if (mounted) setStarting(false)
      } catch (e) {
        if (mounted) {
          setStarting(false)
          setError(
            "Could not access camera. Please allow camera permission or enter the QR code manually."
          )
        }
      }
    }
    init()

    return () => {
      mounted = false
      if (scannerRef.current) {
        scannerRef.current.stop().finally(() => scannerRef.current?.clear())
      }
    }
  }, [onScan])

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl border bg-black">
        <div id={containerId.current} className="mx-auto w-full max-w-sm" />
        {starting && (
          <div className="absolute inset-0 flex items-center justify-center text-white/80">
            <Camera className="mr-2 h-5 w-5 animate-pulse" /> Starting camera…
          </div>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
            aria-label="Close camera"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <CameraOff className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <p className="text-center text-xs text-muted-foreground">
        Point the camera at the QR code posted at the location.
      </p>
    </div>
  )
}

export function ScanButton({ onClick }: { onClick: () => void }) {
  return (
    <Button onClick={onClick} variant="outline" className="w-full">
      <Camera className="mr-2 h-4 w-4" /> Scan with camera
    </Button>
  )
}
