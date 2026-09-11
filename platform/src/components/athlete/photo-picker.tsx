"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveAthletePhoto, type ActionState } from "@/app/my-courts/athletes/actions";
import { AthleteAvatar } from "./avatar";
import { StepHeader, SubmitButton, SecondaryButton } from "./form-ui";

// Photo capture, crop and downscale — all of it in the browser.
//
// Why here and not on the server: a modern phone photo is 3-6MB and 4000px
// wide. Cropping and re-encoding it to a 640px square before it leaves the
// device means the upload is ~80KB, the parent isn't watching a spinner on
// their carrier's uplink, and the server needs no native image toolchain. The
// server still re-validates type and size, because this is a convenience, not
// a security control.
//
// The crop UI is deliberately the smallest thing that works: drag to
// reposition, one zoom slider, fixed square frame. A parent adding three kids
// on a Sunday night should not meet a photo editor.

const OUTPUT_SIZE = 640;
const FRAME = 260;

export default function PhotoPicker({
  athlete,
  athleteId,
  currentPhotoUrl,
  nextHref,
  skipHref,
  eyebrow,
  title = "Add a Photo",
  sub = "Makes it easier for coaches to put names to faces.",
}: {
  athlete: { firstName: string; lastName: string; nickname?: string | null };
  athleteId: string;
  currentPhotoUrl?: string | null;
  nextHref: string;
  skipHref?: string;
  eyebrow?: string;
  title?: string;
  sub?: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionState, FormData>(saveAthletePhoto, { ok: false });

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [cropError, setCropError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const hiddenFileRef = useRef<HTMLInputElement | null>(null);
  const dragging = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (state.ok) router.push(nextHref);
  }, [state, router, nextHref]);

  // Revoke the object URL when it's replaced or the component goes away —
  // otherwise every retake leaks a few megabytes on a device with none spare.
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setImageLoaded(false);
    setCropError(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  function startDrag(e: React.PointerEvent) {
    dragging.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onDrag(e: React.PointerEvent) {
    if (!dragging.current) return;
    setOffset({ x: e.clientX - dragging.current.x, y: e.clientY - dragging.current.y });
  }

  function endDrag() {
    dragging.current = null;
  }

  /**
   * Renders exactly what the frame shows into a square canvas. The frame is a
   * CSS `cover` box, so the scale maths here has to mirror that: whichever
   * image dimension is smaller fills the frame, then the zoom multiplies it.
   */
  async function buildCroppedFile(): Promise<File | null> {
    const img = imgRef.current;
    if (!img) return null;

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const natural = Math.min(img.naturalWidth, img.naturalHeight);
    const coverScale = FRAME / natural;
    const drawScale = coverScale * zoom * (OUTPUT_SIZE / FRAME);

    const drawW = img.naturalWidth * drawScale;
    const drawH = img.naturalHeight * drawScale;
    const dx = (OUTPUT_SIZE - drawW) / 2 + offset.x * (OUTPUT_SIZE / FRAME);
    const dy = (OUTPUT_SIZE - drawH) / 2 + offset.y * (OUTPUT_SIZE / FRAME);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    ctx.drawImage(img, dx, dy, drawW, drawH);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85)
    );
    if (!blob) return null;
    return new File([blob], "athlete.jpg", { type: "image/jpeg" });
  }

  // The cropped result is moved into a real file input before submit, so the
  // form still posts as a normal multipart form action. Every failure path
  // here used to fall through silently — the button looked like it did
  // nothing when the crop failed. Each one now sets a visible error instead.
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!imageUrl) return;
    e.preventDefault();
    setCropError(null);

    if (!imageLoaded) {
      setCropError("Still loading that photo — give it a second and try again.");
      return;
    }

    let file: File | null = null;
    try {
      file = await buildCroppedFile();
    } catch {
      file = null;
    }

    if (!file || !hiddenFileRef.current) {
      setCropError("We couldn't process that photo. Please try again.");
      return;
    }
    const dt = new DataTransfer();
    dt.items.add(file);
    hiddenFileRef.current.files = dt.files;
    e.currentTarget.requestSubmit();
  }

  return (
    <div>
      <StepHeader eyebrow={eyebrow} title={title} sub={sub} />

      <div className="mb-5 flex justify-center">
        {imageUrl ? (
          <div
            className="relative overflow-hidden rounded-full border-2 border-orange bg-gray-light touch-none"
            style={{ width: FRAME, height: FRAME }}
            onPointerDown={startDrag}
            onPointerMove={onDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Reposition your athlete's photo"
              draggable={false}
              onLoad={() => setImageLoaded(true)}
              className="absolute left-1/2 top-1/2 max-w-none select-none"
              style={{
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
                height: FRAME,
                width: "auto",
                minWidth: FRAME,
                objectFit: "cover",
              }}
            />
          </div>
        ) : (
          <AthleteAvatar athlete={athlete} photoUrl={currentPhotoUrl} size="xl" />
        )}
      </div>

      {imageUrl && (
        <div className="mb-6">
          <label className="mb-2 block text-center font-body text-[13.5px] text-gray-dark">
            Drag to reposition · pinch or slide to zoom
          </label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-[var(--color-orange)]"
            aria-label="Zoom"
          />
        </div>
      )}

      <form action={formAction} onSubmit={handleSubmit}>
        <input type="hidden" name="athleteId" value={athleteId} />
        <input ref={hiddenFileRef} type="file" name="photo" className="hidden" />
        <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />

        {(cropError || state.errors?.photo) && (
          <p role="alert" className="mb-3 font-body text-[13.5px] text-danger">
            {cropError ?? state.errors?.photo}
          </p>
        )}

        <div className="flex flex-col gap-2.5">
          {imageUrl ? (
            <>
              <SubmitButton pendingLabel="Saving…">Save Photo</SubmitButton>
              <SecondaryButton type="button" onClick={() => fileRef.current?.click()}>
                Pick a different one
              </SecondaryButton>
            </>
          ) : (
            <SecondaryButton type="button" onClick={() => fileRef.current?.click()}>
              Upload a Photo
            </SecondaryButton>
          )}
        </div>
      </form>

      {skipHref && !imageUrl && (
        <div className="mt-4 text-center">
          <a
            href={skipHref}
            className="font-sport text-[13px] font-bold uppercase tracking-wide text-gray-dark hover:text-orange"
          >
            Skip For Now
          </a>
        </div>
      )}
    </div>
  );
}
