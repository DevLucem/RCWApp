"use client"

import * as React from "react"
import { Laptop, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const [mounted, setMounted] = React.useState(false)
  const { theme, setTheme } = useTheme()

  // useEffect only runs on the client, so now we can safely show the UI
  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
        <div className="flex justify-center gap-1">
            <Button variant="ghost" size="icon" disabled>
                <Sun className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" disabled>
                <Moon className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" disabled>
                <Laptop className="h-4 w-4" />
            </Button>
        </div>
    )
  }

  return (
    <div className="flex justify-center gap-1">
      <Button
        variant={theme === "light" ? "secondary" : "ghost"}
        size="icon"
        onClick={() => setTheme("light")}
        aria-label="Switch to light theme"
      >
        <Sun className="h-4 w-4" />
        <span className="sr-only">Light</span>
      </Button>
      <Button
        variant={theme === "dark" ? "secondary" : "ghost"}
        size="icon"
        onClick={() => setTheme("dark")}
        aria-label="Switch to dark theme"
      >
        <Moon className="h-4 w-4" />
        <span className="sr-only">Dark</span>
      </Button>
      <Button
        variant={theme === "system" ? "secondary" : "ghost"}
        size="icon"
        onClick={() => setTheme("system")}
        aria-label="Switch to system theme"
      >
        <Laptop className="h-4 w-4" />
        <span className="sr-only">System</span>
      </Button>
    </div>
  )
}
