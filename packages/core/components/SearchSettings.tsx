"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Loader2, Search, TestTube, Globe, BookOpen, AlertTriangle, Zap } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ClientModelService } from "@/lib/clientModelService"
import { type SearchConfig, DEFAULT_SEARCH_CONFIG } from "@/lib/types/searchServiceTypes"

interface SearchSettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  embedded?: boolean
}

export function SearchSettings({ open, onOpenChange, embedded = false }: SearchSettingsProps) {
  const [config, setConfig] = useState<SearchConfig>(DEFAULT_SEARCH_CONFIG)
  const [isLoading, setIsLoading] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const { toast } = useToast()

  // Load current configuration when dialog opens
  useEffect(() => {
    if (open) {
      const service = ClientModelService.getInstance()
      const currentConfig = service.getSearchConfig()
      console.log(currentConfig)
      setConfig(currentConfig)
    }
  }, [open])

  const handleSave = () => {
    try {
      const service = ClientModelService.getInstance()

      service.setSearchConfig(config)
      
      // Save to localStorage for persistence
      localStorage.setItem('searchConfig', JSON.stringify(config))
      
      toast({
        title: "Search Settings Saved",
        description: "Your search configuration has been updated.",
      })
      
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save search settings.",
        variant: "destructive",
      })
    }
  }

  const handleTest = async () => {
    setIsTesting(true)
    try {
      const service = ClientModelService.getInstance()
      // Apply current config temporarily for testing
      service.setSearchConfig(config)
      
      const result = await service.testSearch()
      
      if (result.success) {
        toast({
          title: "Search Test Successful",
          description: result.message,
        })
      } else {
        toast({
          title: "Search Test Failed",
          description: result.message,
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Search Test Error",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsTesting(false)
    }
  }

  const handleReset = () => {
    setConfig(DEFAULT_SEARCH_CONFIG)
    toast({
      title: "Settings Reset",
      description: "Search settings have been reset to defaults.",
    })
  }

  // Load saved configuration from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('searchConfig')
      if (saved) {
        const savedConfig = JSON.parse(saved)
        console.log(savedConfig)
        setConfig({ ...DEFAULT_SEARCH_CONFIG, ...savedConfig })
        
        // Apply to service
        const service = ClientModelService.getInstance()
        service.setSearchConfig(savedConfig)
      }
    } catch (error) {
      console.warn('Failed to load saved search config:', error)
    }
  }, [])

  const SettingsContent = () => (
    <div className="space-y-6">
          {/* Main Toggle */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Enable Web Search
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="enable-search"
                  checked={config.enableSearch}
                  onCheckedChange={(checked) => setConfig({ ...config, enableSearch: checked })}
                />
                <Label htmlFor="enable-search">
                  Enable web search to provide additional context for AI generation
                </Label>
              </div>
              
              {config.enableSearch && (
                <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
                  <p>When enabled, the AI will search the web for relevant information before generating test instructions, providing more comprehensive and up-to-date testing scenarios.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Search Sources */}
          {config.enableSearch && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Search Sources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Wikipedia */}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-5 h-5 text-orange-500" />
                    <div>
                      <Label className="font-medium">Wikipedia</Label>
                      <p className="text-sm text-gray-600">Free encyclopedia search (no API key required)</p>
                    </div>
                  </div>
                  <Switch
                    checked={config.enableWikipedia}
                    onCheckedChange={(checked) => setConfig({ ...config, enableWikipedia: checked })}
                  />
                </div>

                {/* Tavily */}
                <div className="flex items-center justify-between p-3 border rounded-lg bg-gradient-to-r from-purple-50 to-blue-50">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-purple-500" />
                    <div>
                      <Label className="font-medium flex items-center gap-2">
                        Tavily AI Search
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-semibold">RECOMMENDED</span>
                      </Label>
                      <p className="text-sm text-gray-600">AI-optimized search engine for LLMs (API key optional)</p>
                    </div>
                  </div>
                  <Switch
                    checked={config.enableTavily}
                    onCheckedChange={(checked) => setConfig({ ...config, enableTavily: checked })}
                  />
                </div>

                {/* Tavily Key Input */}
                {config.enableTavily && (
                  <div className="ml-8 space-y-2">
                    <Label htmlFor="tavily-key">Tavily API Key (Optional)</Label>
                    <Input
                      id="tavily-key"
                      type="password"
                      placeholder="Enter your Tavily API key (optional)"
                      value={config.tavilyApiKey || process.env.TAVILY_API_KEY || ''}
                      onChange={(e) => setConfig({ ...config, tavilyApiKey: e.target.value })}
                    />
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <p className="text-xs text-purple-700">
                        <strong>AI-Optimized:</strong> Tavily is built specifically for AI agents and LLMs, providing concise, ready-to-use information. 
                        Free for personal use (1,000 searches/month). Get your API key from <a href="https://tavily.com" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline font-medium">tavily.com</a>
                      </p>
                    </div>
                  </div>
                )}

                {/* DuckDuckGo */}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Search className="w-5 h-5 text-blue-500" />
                    <div>
                      <Label className="font-medium">DuckDuckGo Instant Answers</Label>
                      <p className="text-sm text-gray-600">Limited search results (no API key required)</p>
                    </div>
                  </div>
                  <Switch
                    checked={config.enableDuckDuckGo}
                    onCheckedChange={(checked) => setConfig({ ...config, enableDuckDuckGo: checked })}
                  />
                </div>

                {/* SerpAPI */}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Search className="w-5 h-5 text-green-500" />
                    <div>
                      <Label className="font-medium">SerpAPI (Google Search)</Label>
                      <p className="text-sm text-gray-600">Professional search API (requires API key)</p>
                    </div>
                  </div>
                  <Switch
                    checked={config.enableSerpApi}
                    onCheckedChange={(checked) => setConfig({ ...config, enableSerpApi: checked })}
                  />
                </div>

                {/* SerpAPI Key Input */}
                {config.enableSerpApi && (
                  <div className="ml-8 space-y-2">
                    <Label htmlFor="serpapi-key">SerpAPI Key (Optional)</Label>
                    <Input
                      id="serpapi-key"
                      type="password"
                      placeholder="Enter your SerpAPI key (optional)"
                      value={config.serpApiKey || ''}
                      onChange={(e) => setConfig({ ...config, serpApiKey: e.target.value })}
                    />
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-xs text-blue-700">
                        <strong>Optional:</strong> If no API key is provided, the server will attempt to use a configured environment variable (SERPAPI_API_KEY). 
                        You can get your own API key from <a href="https://serpapi.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">serpapi.com</a>
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Advanced Settings */}
          {config.enableSearch && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Advanced Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="max-results">Maximum Search Results</Label>
                  <Input
                    id="max-results"
                    type="number"
                    min="1"
                    max="10"
                    value={config.maxSearchResults}
                    onChange={(e) => setConfig({ ...config, maxSearchResults: parseInt(e.target.value) || 5 })}
                  />
                  <p className="text-xs text-gray-500 mt-1">Number of search results to include (1-10)</p>
                </div>

                <div>
                  <Label htmlFor="timeout">Search Timeout (ms)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    min="5000"
                    max="30000"
                    step="1000"
                    value={config.searchTimeout}
                    onChange={(e) => setConfig({ ...config, searchTimeout: parseInt(e.target.value) || 10000 })}
                  />
                  <p className="text-xs text-gray-500 mt-1">Maximum time to wait for search results (5-30 seconds)</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={handleReset}>
              Reset to Defaults
            </Button>
            
            {config.enableSearch && (
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={isTesting}
                className="flex items-center gap-2"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <TestTube className="w-4 h-4" />
                    Test Search
                  </>
                )}
              </Button>
            )}
            
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Settings"
              )}
            </Button>
          </div>
    </div>
  )

  if (embedded) {
    return (
      <div className="w-full">
        <div className="mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Search className="w-6 h-6" />
            Web Search Settings
          </h2>
          <p className="text-gray-600 mt-2">Configure web search integration for enhanced AI generation</p>
        </div>
        <SettingsContent />
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Web Search Settings
          </DialogTitle>
        </DialogHeader>
        <SettingsContent />
      </DialogContent>
    </Dialog>
  )
}