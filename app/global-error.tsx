'use client'

export default function GlobalError({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body className="flex min-h-screen flex-col items-center justify-center bg-[#fefcfa] px-6 text-center text-[#1e1b17]">
        <h1 className="font-serif text-2xl font-normal">Something went wrong</h1>
        <p className="mt-2 max-w-md text-sm text-[#756b62]">
          A critical error occurred. Please try again or refresh the page.
        </p>
        <button
          onClick={() => reset()}
          className="mt-6 rounded-full bg-[#1e1b17] px-6 py-2 text-sm font-medium text-white hover:bg-[#1e1b17]/90"
        >
          Try again
        </button>
      </body>
    </html>
  )
}
