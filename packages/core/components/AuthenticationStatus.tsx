"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { logout } from "@/app/login/actions"
import { ChevronDown, ChevronUp } from "lucide-react"
import { SyncControls } from "./SyncControls"
import type { TestPlanWithHistory } from "@/lib/types/testPlanTypes"

interface AuthenticationStatusProps {
  isAuthenticated: boolean
  userEmail?: string
  syncToServer?: () => Promise<void>
  syncFromServer?: () => Promise<TestPlanWithHistory[]>
  syncData?: () => Promise<TestPlanWithHistory[]>
  syncAllToServer?: () => Promise<void>
  syncAllFromServer?: () => Promise<void>
  onSyncSuccess?: (plans: TestPlanWithHistory[]) => void
  onError?: (message: string) => void
  onSuccess?: (message: string) => void
}

export function AuthenticationStatus({
  isAuthenticated,
  userEmail,
  syncToServer,
  syncFromServer,
  syncData,
  syncAllToServer,
  syncAllFromServer,
  onSyncSuccess,
  onError,
  onSuccess
}: AuthenticationStatusProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm">
        <div className={`w-2 h-2 rounded-full ${isAuthenticated ? 'bg-green-500' : 'bg-gray-400'}`}></div>
        <span className="text-gray-600">
          {isAuthenticated ? userEmail : ''}
        </span>
        {!isAuthenticated ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.href = '/login'}
            className="ml-2 px-2 py-1 text-xs text-blue-600 hover:text-blue-800"
          >
            Sign In
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 h-6 w-6"
              title={isExpanded ? "Hide sync controls" : "Show sync controls"}
            >
              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>
            <form action={logout}>
              <Button
                variant="outline"
                type="submit"
                className="px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50"
                title="Sign out"
              >
                Sign Out
              </Button>
            </form>
          </>
        )}
      </div>

      {isAuthenticated && isExpanded && syncToServer && syncFromServer && syncData && syncAllToServer && syncAllFromServer && onSyncSuccess && onError && onSuccess && (
        <div className="flex gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
          <SyncControls
            syncToServer={syncToServer}
            syncFromServer={syncFromServer}
            syncData={syncData}
            syncAllToServer={syncAllToServer}
            syncAllFromServer={syncAllFromServer}
            onSyncSuccess={onSyncSuccess}
            onError={onError}
            onSuccess={onSuccess}
          />
        </div>
      )}
    </div>
  )
}