'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { FiTrash2 } from "react-icons/fi"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { clearAllReportsAction } from '@/lib/server-actions/reports'

export function SidebarFooter() {
    const router = useRouter()
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)
    const [showClearAllDialog, setShowClearAllDialog] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const handleClearAll = async (confirmed: boolean) => {
        if (confirmed) {
            try {
                await clearAllReportsAction()
                router.replace("/")
                router.refresh()
            } catch (err) {
                console.error('Failed to clear reports:', err)
            }
        }
        setShowClearAllDialog(false)
    }

    const getThemeDisplay = (currentTheme: string | undefined) => {
        switch (currentTheme?.toLowerCase()) {
            case 'light': return 'Light'
            case 'dark': return 'Dark'
            default: return 'System'
        }
    }

    return (
        <div className="mt-auto">
            {/* Clear All button */}
            <div className="p-4 border-t dark:border-gray-700">
                <Button
                    variant="ghost"
                    className="w-full justify-start px-2 gap-2 font-normal text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10"
                    onClick={() => setShowClearAllDialog(true)}
                >
                    <FiTrash2 className="h-4 w-4" />
                    Clear All Reports
                </Button>
            </div>

            {/* Theme toggle */}
            <div className="p-4 border-t dark:border-gray-700">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            className="w-full justify-start px-2 gap-2 font-normal"
                        >
                            {theme === 'dark' ? (
                                <Moon className="h-4 w-4" />
                            ) : (
                                <Sun className="h-4 w-4" />
                            )}
                            <span>{mounted ? getThemeDisplay(theme) : 'System'} Theme</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="min-w-[8rem] border bg-white dark:border-gray-700 dark:bg-[#191a1a] shadow-lg"
                        align="start"
                        side="top"
                    >
                        <DropdownMenuItem
                            className="cursor-pointer dark:focus:bg-gray-800"
                            onClick={() => setTheme("light")}
                        >
                            Light
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="cursor-pointer dark:focus:bg-gray-800"
                            onClick={() => setTheme("dark")}
                        >
                            Dark
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="cursor-pointer dark:focus:bg-gray-800"
                            onClick={() => setTheme("system")}
                        >
                            System
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Clear All Confirmation Dialog */}
            <Dialog open={showClearAllDialog} onOpenChange={() => setShowClearAllDialog(false)}>
                <DialogContent className="bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700">
                    <DialogHeader>
                        <DialogTitle className="text-gray-900 dark:text-gray-100 mb-5">
                            Clear All Reports
                        </DialogTitle>
                        <DialogDescription className="text-gray-600 dark:text-gray-400">
                            Are you sure you want to delete all research reports? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button
                            variant="outline"
                            onClick={() => handleClearAll(false)}
                            className="hover:bg-gray-200 dark:hover:bg-gray-700"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => handleClearAll(true)}
                            className="bg-red-500 hover:bg-red-600 text-white dark:bg-red-600 dark:hover:bg-red-700"
                        >
                            Yes, Clear All
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
