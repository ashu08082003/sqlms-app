"use client"

import { useEffect, useRef, useState } from "react"
import QRCode from "qrcode"
import { cn } from "@/lib/utils"

interface QrCodeProps {
  value: string
  size?: number
  className?: string
}

export function QrCode({ value, size = 200, className }: QrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string>("")
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(""))
  }, [value, size])

  return (
    <div className={cn("inline-flex items-center justify-center", className)}>
      {dataUrl ? (
        <img
          src={dataUrl}
          alt={`QR code for ${value}`}
          width={size}
          height={size}
          className="rounded-lg bg-white p-2 ring-1 ring-border"
        />
      ) : (
        <div
          ref={canvasRef}
          style={{ width: size, height: size }}
          className="animate-pulse rounded-lg bg-muted"
        />
      )}
      <span className="sr-only">QR code: {value}</span>
    </div>
  )
}

export async function downloadQrPng(value: string, filename: string) {
  const url = await QRCode.toDataURL(value, {
    width: 600,
    margin: 2,
    color: { dark: "#0f172a", light: "#ffffff" },
    errorCorrectionLevel: "M",
  })
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
}
