"use client"

import { Button } from "@/components/ui/button"
import { ArrowUp, ArrowDown, RefreshCw } from "lucide-react"
import type { TestPlanWithHistory } from "@/lib/types/testPlanTypes"

interface SyncControlsProps {
  syncToServer: () => Promise<void>
  syncFromServer: () => Promise<TestPlanWithHistory[]>
  syncData: () => Promise<TestPlanWithHistory[]>
  syncAllToServer: () => Promise<void>
  syncAllFromServer: () => Promise<void>
  onSyncSuccess: (plans: TestPlanWithHistory[]) => void
  onError: (message: string) => void
  onSuccess: (message: string) => void
}

export function SyncControls({
  syncToServer,
  syncFromServer,
  syncData,
  syncAllToServer,
  syncAllFromServer,
  onSyncSuccess,
  onError,
  onSuccess
}: SyncControlsProps) {
  const handleSyncToServer = async () => {
    try {
      await syncToServer()
      onSuccess("Test plans uploaded to server")
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to upload")
    }
  }

  const handleSyncFromServer = async () => {
    try {
      const serverData = await syncFromServer()
      onSyncSuccess(serverData)
      onSuccess(`Downloaded ${serverData.length} test plans`)
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to download")
    }
  }

  const handleSyncData = async () => {
    try {
      const mergedData = await syncData()
      onSyncSuccess(mergedData)
      onSuccess(`Merged ${mergedData.length} test plans`)
    } catch (error) {
      onError("Failed to merge test plans")
    }
  }

  const handleSyncAllToServer = async () => {
    try {
      await syncAllToServer()
      onSuccess("All settings and data uploaded to server")
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to upload all data")
    }
  }

  const handleSyncAllFromServer = async () => {
    try {
      await syncAllFromServer()
      // Reload the page to reflect all changes
      window.location.reload()
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to download all data")
    }
  }

  return (
    <>
      <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg">
        <span className="text-xs text-gray-600 mr-1">Plans:</span>

        {/* Upload Test Plans Only */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSyncToServer}
          className="p-1 h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
          title="Upload test plans to server"
        >
          <ArrowUp className="w-3 h-3" />
        </Button>

        {/* Download Test Plans Only */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSyncFromServer}
          className="p-1 h-6 w-6 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          title="Download test plans from server"
        >
          <ArrowDown className="w-3 h-3" />
        </Button>

        {/* Smart Merge Test Plans */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSyncData}
          className="p-1 h-6 w-6 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
          title="Smart merge test plans"
        >
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>

      <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg">
        <span className="text-xs text-gray-600 mr-1">All:</span>

        {/* Upload ALL Data */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSyncAllToServer}
          className="p-1 h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
          title="Upload ALL data (plans, templates, settings) to server"
        >
          <ArrowUp className="w-3 h-3" />
        </Button>

        {/* Download ALL Data */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSyncAllFromServer}
          className="p-1 h-6 w-6 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          title="Download ALL data (plans, templates, settings) from server"
        >
          <ArrowDown className="w-3 h-3" />
        </Button>
      </div>
    </>
  )
}