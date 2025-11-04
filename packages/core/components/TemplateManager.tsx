"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, Copy, Eye, Settings2, X, ArrowUp, ArrowDown, Search, Type } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  type ModelConfig,
  type ModelConfigFormData,
  type ModelProvider,
  DEFAULT_MODEL_CONFIGS,
  PROVIDER_INFO,
  loadModelConfigs,
  saveModelConfigs,
  getActiveModelsByPriority
} from "@/lib/types/modelTypes"
import {
  type SemanticSearchTarget,
  type SemanticSearchTargetFormData,
} from "@/lib/types/semanticSearchTypes"
import { fetchAvailableModels, type AvailableModel } from "@/lib/serverModelFetcherFromProviders"
import {
  type SystemMessageTemplate,
  type TemplateFormData,
  type InstructionTypesTemplate,
  DEFAULT_GENERATION_TEMPLATE,
  DEFAULT_MODIFICATION_TEMPLATE,
  DEFAULT_INSTRUCTION_TYPES_TEMPLATE,
  DEFAULT_EXPAND_TEMPLATE,
} from "@/lib/types/templateTypes"
import { SearchSettings } from "@/components/SearchSettings"

interface TemplateManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTemplateSelect: (template: SystemMessageTemplate, type: "generation" | "modification" | "instruction-types" | "expand") => void
  selectedGenerationTemplate?: SystemMessageTemplate | null
  selectedModificationTemplate?: SystemMessageTemplate | null
  selectedInstructionTypesTemplate?: InstructionTypesTemplate | null
  selectedExpandTemplate?: SystemMessageTemplate | null
}

export function TemplateManager({
  open,
  onOpenChange,
  onTemplateSelect,
  selectedGenerationTemplate,
  selectedModificationTemplate,
  selectedInstructionTypesTemplate,
  selectedExpandTemplate,
}: TemplateManagerProps) {
  const [templates, setTemplates] = useState<SystemMessageTemplate[]>([])
  const [editingTemplate, setEditingTemplate] = useState<SystemMessageTemplate | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showPreview, setShowPreview] = useState<SystemMessageTemplate | null>(null)
  const [formData, setFormData] = useState<TemplateFormData>({
    name: "",
    description: "",
    userMessage: "",
    type: "generation",
    orderMode: "ordered",
    modelOverride: undefined,
  })
  const [editingTypes, setEditingTypes] = useState<string[]>([])
  const [newType, setNewType] = useState("")
  const [activeTab, setActiveTab] = useState<"templates" | "models" | "settings" | "instruction-types">("templates")

  // Semantic search targets for current template being edited
  const [editingSemanticSearchTargets, setEditingSemanticSearchTargets] = useState<SemanticSearchTarget[]>([])
  const [showAddSemanticTarget, setShowAddSemanticTarget] = useState(false)
  const [newSemanticTarget, setNewSemanticTarget] = useState<SemanticSearchTargetFormData>({
    name: "",
    codebasePath: "./",
    maxResults: 10,
    description: "",
    isActive: true,
  })
  
  // Model management state
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>([])
  const [editingModelConfig, setEditingModelConfig] = useState<ModelConfig | null>(null)
  const [showModelForm, setShowModelForm] = useState(false)
  const [showModelPreview, setShowModelPreview] = useState<ModelConfig | null>(null)
  const [availableModels, setAvailableModels] = useState<Record<ModelProvider, AvailableModel[]>>({
    groq: [],
    openai: [],
    anthropic: [],
    gemini: []
  })
  const [loadingModels, setLoadingModels] = useState<Record<ModelProvider, boolean>>({
    groq: false,
    openai: false,
    anthropic: false,
    gemini: false
  })
  const [modelFormData, setModelFormData] = useState<ModelConfigFormData>({
    name: "",
    provider: "groq",
    model: "",
    apiKey: "",
    baseUrl: "",
    temperature: 0,
    maxTokens: 4000,
    timeout: 30000,
    maxRetries: 3,
    isActive: true,
  })

  // Available collections for semantic search targets
  const [availableCollections, setAvailableCollections] = useState<Array<{name: string, path: string}>>([])
  const [loadingCollections, setLoadingCollections] = useState(false)

  const { toast } = useToast()

  useEffect(() => {
    loadTemplates()
    loadModelConfigsData()
    // Fetch available collections
    fetchCollections()
  }, [])

  const fetchCollections = async () => {
    setLoadingCollections(true)
    try {
      const response = await fetch('/api/semantic-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'get_collections' }),
      })

      const data = await response.json()
      if (data.success && data.collections) {
        setAvailableCollections(data.collections)
      } else {
        toast({
          title: "Failed to fetch collections",
          description: data.error || "Could not load available collections",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error fetching collections:', error)
      toast({
        title: "Error",
        description: "Failed to fetch collections",
        variant: "destructive",
      })
    } finally {
      setLoadingCollections(false)
    }
  }


  const loadModelConfigsData = () => {
    const loadedConfigs = loadModelConfigs()
    setModelConfigs(loadedConfigs)
  }

  const loadTemplates = () => {
    const savedTemplates = localStorage.getItem("systemMessageTemplates")
    if (savedTemplates) {
      try {
        const parsedTemplates = JSON.parse(savedTemplates)
        setTemplates([...parsedTemplates, DEFAULT_GENERATION_TEMPLATE, DEFAULT_MODIFICATION_TEMPLATE, DEFAULT_INSTRUCTION_TYPES_TEMPLATE, DEFAULT_EXPAND_TEMPLATE])
      } catch (error) {
        console.error("Error loading templates:", error)
        setTemplates([DEFAULT_GENERATION_TEMPLATE, DEFAULT_MODIFICATION_TEMPLATE, DEFAULT_INSTRUCTION_TYPES_TEMPLATE, DEFAULT_EXPAND_TEMPLATE])
      }
    } else {
      setTemplates([DEFAULT_GENERATION_TEMPLATE, DEFAULT_MODIFICATION_TEMPLATE, DEFAULT_INSTRUCTION_TYPES_TEMPLATE, DEFAULT_EXPAND_TEMPLATE])
    }
  }

  const saveTemplates = (updatedTemplates: SystemMessageTemplate[]) => {
    const nonDefaultTemplates = updatedTemplates.filter((t) => !t.isDefault)
    localStorage.setItem("systemMessageTemplates", JSON.stringify(nonDefaultTemplates))
    setTemplates([...nonDefaultTemplates, DEFAULT_GENERATION_TEMPLATE, DEFAULT_MODIFICATION_TEMPLATE, DEFAULT_INSTRUCTION_TYPES_TEMPLATE, DEFAULT_EXPAND_TEMPLATE])
  }

  const handleSaveTemplate = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Name is required",
        variant: "destructive",
      })
      return
    }

    if (formData.type !== 'instruction-types' && !formData.userMessage.trim()) {
      toast({
        title: "Validation Error",
        description: "User message is required for generation and modification templates",
        variant: "destructive",
      })
      return
    }

    if (formData.type === 'instruction-types' && editingTypes.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one instruction type is required",
        variant: "destructive",
      })
      return
    }

    const now = new Date().toISOString()

    if (editingTemplate) {
      const updatedTemplate: SystemMessageTemplate = formData.type === 'instruction-types'
        ? {
            ...editingTemplate,
            name: formData.name,
            description: formData.description,
            userMessage: formData.userMessage || 'This template defines the available instruction types for test categorization.',
            type: formData.type,
            orderMode: formData.orderMode,
            updatedAt: now,
            semanticSearchTargets: editingSemanticSearchTargets,
            modelOverride: formData.modelOverride,
            ...(editingTemplate.type === 'instruction-types' && { availableTypes: editingTypes }),
          } as InstructionTypesTemplate
        : {
            ...editingTemplate,
            name: formData.name,
            description: formData.description,
            userMessage: formData.userMessage,
            type: formData.type,
            orderMode: formData.orderMode,
            updatedAt: now,
            semanticSearchTargets: editingSemanticSearchTargets,
            modelOverride: formData.modelOverride,
          }

      const updatedTemplates = templates.map((t) => (t.id === editingTemplate.id ? updatedTemplate : t))


      saveTemplates(updatedTemplates)
      if (editingTemplate.type === 'generation' && selectedGenerationTemplate?.id === editingTemplate.id)
        onTemplateSelect(updatedTemplate, 'generation')
      if (editingTemplate.type === 'modification' && selectedModificationTemplate?.id === editingTemplate.id)
        onTemplateSelect(updatedTemplate, 'modification')
      if (editingTemplate.type === "expand" && selectedExpandTemplate?.id === editingTemplate.id)
        onTemplateSelect(updatedTemplate, "expand")

      toast({
        title: "Template Updated",
        description: `Template "${formData.name}" has been updated`,
      })
    } else {
      const newTemplate: SystemMessageTemplate = formData.type === 'instruction-types'
        ? {
            id: `template-${Date.now()}-${Math.random()}`,
            name: formData.name,
            description: formData.description,
            userMessage: formData.userMessage || 'This template defines the available instruction types for test categorization.',
            type: formData.type,
            orderMode: formData.orderMode,
            createdAt: now,
            updatedAt: now,
            isDefault: false,
            semanticSearchTargets: editingSemanticSearchTargets,
            modelOverride: formData.modelOverride,
            availableTypes: editingTypes,
          } as InstructionTypesTemplate
        : {
            id: `template-${Date.now()}-${Math.random()}`,
            name: formData.name,
            description: formData.description,
            userMessage: formData.userMessage,
            type: formData.type,
            orderMode: formData.orderMode,
            createdAt: now,
            updatedAt: now,
            isDefault: false,
            semanticSearchTargets: editingSemanticSearchTargets,
            modelOverride: formData.modelOverride,
          }

      const updatedTemplates = [...templates, newTemplate]
      saveTemplates(updatedTemplates)

      toast({
        title: "Template Created",
        description: `Template "${formData.name}" has been created`,
      })
    }

    resetForm()
  }

  const handleEditTemplate = (template: SystemMessageTemplate) => {
    if (template.isDefault) {
      handleDuplicateTemplate(template)
      return
    }

    setEditingTemplate(template)
    setFormData({
      name: template.name,
      description: template.description,
      userMessage: template.userMessage,
      type: template.type,
      orderMode: template.orderMode || 'ordered',
      modelOverride: template.modelOverride,
    })

    // If it's an instruction types template, load the types
    if (template.type === 'instruction-types') {
      const typesTemplate = template as InstructionTypesTemplate
      setEditingTypes(typesTemplate.availableTypes || [])
    } else {
      setEditingTypes([])
    }

    // Load semantic search targets
    setEditingSemanticSearchTargets(template.semanticSearchTargets || [])

    setShowForm(true)
  }

  const handleDuplicateTemplate = (template: SystemMessageTemplate) => {
    setEditingTemplate(null)
    setFormData({
      name: `${template.name} (Copy)`,
      description: template.description,
      userMessage: template.userMessage,
      type: template.type,
      orderMode: template.orderMode || 'ordered',
      modelOverride: template.modelOverride,
    })

    // If it's an instruction types template, copy the types
    if (template.type === 'instruction-types') {
      const typesTemplate = template as InstructionTypesTemplate
      setEditingTypes(typesTemplate.availableTypes || [])
    } else {
      setEditingTypes([])
    }

    // Copy semantic search targets
    setEditingSemanticSearchTargets(template.semanticSearchTargets || [])

    setShowForm(true)
  }

  const handleDeleteTemplate = (template: SystemMessageTemplate) => {
    if (template.isDefault) {
      toast({
        title: "Cannot Delete",
        description: "Default templates cannot be deleted",
        variant: "destructive",
      })
      return
    }

    const updatedTemplates = templates.filter((t) => t.id !== template.id)
    saveTemplates(updatedTemplates)

    toast({
      title: "Template Deleted",
      description: `Template "${template.name}" has been deleted`,
    })
  }

  const resetForm = () => {
    setEditingTemplate(null)
    setShowForm(false)
    setFormData({
      name: "",
      description: "",
      userMessage: "",
      type: "generation",
      orderMode: "ordered",
      modelOverride: undefined,
    })
    setEditingTypes([])
    setNewType("")
    setEditingSemanticSearchTargets([])
    setShowAddSemanticTarget(false)
    setNewSemanticTarget({
      name: "",
      codebasePath: "./",
      maxResults: 10,
      description: "",
      isActive: true,
    })
  }

  const handleAddType = () => {
    const trimmedType = newType.trim()
    if (!trimmedType) return
    
    if (editingTypes.some(type => type.toLowerCase() === trimmedType.toLowerCase())) {
      toast({
        title: "Duplicate Type",
        description: "This type already exists",
        variant: "destructive",
      })
      return
    }
    
    setEditingTypes([...editingTypes, trimmedType])
    setNewType("")
  }

  const handleRemoveType = (typeToRemove: string) => {
    setEditingTypes(editingTypes.filter(type => type !== typeToRemove))
  }

  // Semantic search target management for templates
  const handleAddSemanticTargetToTemplate = () => {
    if (!newSemanticTarget.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Target name is required",
        variant: "destructive",
      })
      return
    }

    if (!newSemanticTarget.codebasePath.trim()) {
      toast({
        title: "Validation Error",
        description: "Codebase path is required",
        variant: "destructive",
      })
      return
    }

    const now = new Date().toISOString()
    const maxPriority = Math.max(...editingSemanticSearchTargets.map(t => t.priority), 0)

    const target: SemanticSearchTarget = {
      id: `semantic-target-${Date.now()}-${Math.random()}`,
      name: newSemanticTarget.name,
      codebasePath: newSemanticTarget.codebasePath,
      maxResults: newSemanticTarget.maxResults,
      description: newSemanticTarget.description || "",
      isActive: newSemanticTarget.isActive,
      priority: maxPriority + 1,
      createdAt: now,
      updatedAt: now,
    }

    setEditingSemanticSearchTargets([...editingSemanticSearchTargets, target])
    setShowAddSemanticTarget(false)
    setNewSemanticTarget({
      name: "",
      codebasePath: "./",
      maxResults: 10,
      description: "",
      isActive: true,
    })

    toast({
      title: "Target Added",
      description: `Semantic search target "${target.name}" has been added`,
    })
  }

  const handleRemoveSemanticTargetFromTemplate = (targetId: string) => {
    setEditingSemanticSearchTargets(editingSemanticSearchTargets.filter(t => t.id !== targetId))
  }

  const handleToggleSemanticTargetInTemplate = (targetId: string) => {
    setEditingSemanticSearchTargets(editingSemanticSearchTargets.map(t =>
      t.id === targetId ? { ...t, isActive: !t.isActive } : t
    ))
  }

  // Model management functions
  const handleSaveModelConfig = () => {
    if (!modelFormData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Name is required",
        variant: "destructive",
      })
      return
    }

    if (!modelFormData.model.trim()) {
      toast({
        title: "Validation Error",
        description: "Model is required",
        variant: "destructive",
      })
      return
    }

    if (PROVIDER_INFO[modelFormData.provider].requiresApiKey && !modelFormData.apiKey.trim() && (modelFormData.provider !== 'groq' && !process.env.GROQ_API_KEY)) {
      toast({
        title: "Validation Error",
        description: `API Key is required for ${modelFormData.provider}`,
        variant: "destructive",
      })
      return
    }


    if (editingModelConfig) {
      const updatedConfig: ModelConfig = {
        ...editingModelConfig,
        name: modelFormData.name,
        provider: modelFormData.provider,
        model: modelFormData.model,
        apiKey: modelFormData.apiKey || undefined,
        baseUrl: modelFormData.baseUrl || undefined,
        temperature: modelFormData.temperature,
        maxTokens: modelFormData.maxTokens,
        timeout: modelFormData.timeout,
        maxRetries: modelFormData.maxRetries,
        isActive: modelFormData.isActive,
      }

      const updatedConfigs = modelConfigs.map((c) => (c.id === editingModelConfig.id ? updatedConfig : c))
      setModelConfigs(updatedConfigs)
      saveModelConfigs(updatedConfigs)

      toast({
        title: "Model Configuration Updated",
        description: `Configuration "${modelFormData.name}" has been updated`,
      })
    } else {
      const maxPriority = Math.max(...modelConfigs.map(c => c.priority), 0)
      if (modelFormData.provider == 'groq' && process.env.GROQ_API_KEY) {
        modelFormData.apiKey = process.env.GROQ_API_KEY
      }

      const newConfig: ModelConfig = {
        id: `config-${Date.now()}-${Math.random()}`,
        name: modelFormData.name,
        provider: modelFormData.provider,
        model: modelFormData.model,
        apiKey: modelFormData.apiKey || undefined,
        baseUrl: modelFormData.baseUrl || undefined,
        temperature: modelFormData.temperature,
        maxTokens: modelFormData.maxTokens,
        timeout: modelFormData.timeout,
        maxRetries: modelFormData.maxRetries,
        isActive: modelFormData.isActive,
        priority: maxPriority + 1,
      }

      const updatedConfigs = [...modelConfigs, newConfig]
      setModelConfigs(updatedConfigs)
      saveModelConfigs(updatedConfigs)

      toast({
        title: "Model Configuration Created",
        description: `Configuration "${modelFormData.name}" has been created`,
      })
    }

    resetModelForm()
  }

  const handleEditModelConfig = (config: ModelConfig) => {
    setEditingModelConfig(config)
    setModelFormData({
      name: config.name,
      provider: config.provider,
      model: config.model,
      apiKey: config.apiKey || "",
      baseUrl: config.baseUrl || "",
      temperature: config.temperature || 0,
      maxTokens: config.maxTokens || 4000,
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
      isActive: config.isActive,
    })
    setShowModelForm(true)
  }

  const handleDeleteModelConfig = (config: ModelConfig) => {
    const updatedConfigs = modelConfigs.filter((c) => c.id !== config.id)
    setModelConfigs(updatedConfigs)
    saveModelConfigs(updatedConfigs)

    toast({
      title: "Configuration Deleted",
      description: `Configuration "${config.name}" has been deleted`,
    })
  }

  const handleRestoreDefaultModels = () => {
    const existingIds = new Set(modelConfigs.map(c => c.id))
    const missingDefaults = DEFAULT_MODEL_CONFIGS.filter(defaultConfig => 
      !existingIds.has(defaultConfig.id)
    )

    if (missingDefaults.length === 0) {
      toast({
        title: "No Action Needed",
        description: "All default models are already present",
        variant: "destructive",
      })
      return
    }

    const updatedConfigs = [...modelConfigs, ...missingDefaults]
    setModelConfigs(updatedConfigs)
    saveModelConfigs(updatedConfigs)

    toast({
      title: "Default Models Restored",
      description: `Added ${missingDefaults.length} default model(s): ${missingDefaults.map(c => c.name).join(', ')}`,
    })
  }

  const handleToggleModelActive = (config: ModelConfig) => {
    const updatedConfig = { ...config, isActive: !config.isActive }
    const updatedConfigs = modelConfigs.map((c) => (c.id === config.id ? updatedConfig : c))
    setModelConfigs(updatedConfigs)
    saveModelConfigs(updatedConfigs)

    toast({
      title: `Configuration ${updatedConfig.isActive ? 'Enabled' : 'Disabled'}`,
      description: `Configuration "${config.name}" has been ${updatedConfig.isActive ? 'enabled' : 'disabled'}`,
    })
  }

  const handleMoveModelPriority = (config: ModelConfig, direction: 'up' | 'down') => {
    const currentPriority = config.priority
    const targetConfig = modelConfigs.find(c => 
      direction === 'up' ? c.priority === currentPriority - 1 : c.priority === currentPriority + 1
    )

    if (targetConfig) {
      const updatedConfigs = modelConfigs.map(c => {
        if (c.id === config.id) return { ...c, priority: targetConfig.priority }
        if (c.id === targetConfig.id) return { ...c, priority: currentPriority }
        return c
      })
      
      setModelConfigs(updatedConfigs)
      saveModelConfigs(updatedConfigs)

      toast({
        title: "Priority Updated",
        description: `Moved "${config.name}" ${direction}`,
      })
    }
  }

  const resetModelForm = () => {
    setEditingModelConfig(null)
    setShowModelForm(false)
    const defaultProvider: ModelProvider = "groq"
    const defaultModel = ""
    setModelFormData({
      name: generateDefaultConfigName(defaultProvider, defaultModel),
      provider: defaultProvider,
      model: defaultModel,
      apiKey: "",
      baseUrl: PROVIDER_INFO[defaultProvider].defaultBaseUrl || "",
      temperature: 0,
      maxTokens: 4000,
      timeout: 30000,
      maxRetries: 3,
      isActive: true,
    })
  }

  const fetchModelsForProvider = async (provider: ModelProvider, apiKey?: string) => {
    setLoadingModels(prev => ({ ...prev, [provider]: true }))
    
    try {
      const result = await fetchAvailableModels(provider, apiKey)
      
      if (result.success) {
        setAvailableModels(prev => ({ ...prev, [provider]: result.models }))
        
        // If this is the current provider in the form, update the model selection
        if (modelFormData.provider === provider) {
          const firstModel = result.models[0]?.id || ""
          setModelFormData(prev => ({
            ...prev,
            model: firstModel,
            name: generateDefaultConfigName(provider, firstModel)
          }))
        }
      } else {
        toast({
          title: "Failed to fetch models",
          description: result.error || `Could not load models for ${provider}`,
          variant: "destructive",
        })
        
      }
    } catch (error) {
      console.error(`Error fetching models for ${provider}:`, error)
      toast({
        title: "Error",
        description: `Failed to fetch models for ${provider}`,
        variant: "destructive",
      })
    } finally {
      setLoadingModels(prev => ({ ...prev, [provider]: false }))
    }
  }

  const handleModelProviderChange = async (provider: ModelProvider) => {
    const providerInfo = PROVIDER_INFO[provider]
    
    // Get available models for this provider
    const currentModels = availableModels[provider]
    let defaultModel = ""
    
    await fetchModelsForProvider(provider, modelFormData.apiKey)
    defaultModel = availableModels[provider][0]?.id  || ""
    
    setModelFormData({
      ...modelFormData,
      provider,
      model: defaultModel,
      baseUrl: providerInfo.defaultBaseUrl || "",
      name: generateDefaultConfigName(provider, defaultModel),
    })
  }

  const handleModelChange = (model: string) => {
    setModelFormData({
      ...modelFormData,
      model,
      name: generateDefaultConfigName(modelFormData.provider, model),
    })
  }

  const generateDefaultConfigName = (provider: ModelProvider, model: string): string => {
    const providerName = PROVIDER_INFO[provider].name
    return `${providerName} ${model}`
  }

  const handleCopyModelConfig = (config: ModelConfig) => {
    const defaultName = generateDefaultConfigName(config.provider, config.model)
    setEditingModelConfig(null)
    setModelFormData({
      name: `${defaultName} (Copy)`,
      provider: config.provider,
      model: config.model,
      apiKey: config.apiKey || "",
      baseUrl: config.baseUrl || "",
      temperature: config.temperature || 0,
      maxTokens: config.maxTokens || 4000,
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
      isActive: config.isActive,
    })
    setShowModelForm(true)
  }

  // Semantic Search management functions
  const handleSaveSemanticTarget = () => {
    if (!semanticFormData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Name is required",
        variant: "destructive",
      })
      return
    }

    if (!semanticFormData.codebasePath.trim()) {
      toast({
        title: "Validation Error",
        description: "Codebase path is required",
        variant: "destructive",
      })
      return
    }

    if (semanticFormData.maxResults < 1 || semanticFormData.maxResults > 50) {
      toast({
        title: "Validation Error",
        description: "Max results must be between 1 and 50",
        variant: "destructive",
      })
      return
    }

    const now = new Date().toISOString()

    if (editingSemanticTarget) {
      const updatedTarget: SemanticSearchTarget = {
        ...editingSemanticTarget,
        name: semanticFormData.name,
        codebasePath: semanticFormData.codebasePath,
        maxResults: semanticFormData.maxResults,
        description: semanticFormData.description || "",
        isActive: semanticFormData.isActive,
        updatedAt: now,
      }

      const updatedTargets = semanticSearchConfig.targets.map((t) =>
        t.id === editingSemanticTarget.id ? updatedTarget : t
      )

      const updatedConfig = { ...semanticSearchConfig, targets: updatedTargets }
      setSemanticSearchConfig(updatedConfig)
      saveSemanticSearchConfig(updatedConfig)

      toast({
        title: "Semantic Search Target Updated",
        description: `Target "${semanticFormData.name}" has been updated`,
      })
    } else {
      const maxPriority = Math.max(...semanticSearchConfig.targets.map(t => t.priority), 0)

      const newTarget: SemanticSearchTarget = {
        id: `semantic-target-${Date.now()}-${Math.random()}`,
        name: semanticFormData.name,
        codebasePath: semanticFormData.codebasePath,
        maxResults: semanticFormData.maxResults,
        description: semanticFormData.description || "",
        isActive: semanticFormData.isActive,
        priority: maxPriority + 1,
        createdAt: now,
        updatedAt: now,
      }

      const updatedConfig = {
        ...semanticSearchConfig,
        targets: [...semanticSearchConfig.targets, newTarget]
      }
      setSemanticSearchConfig(updatedConfig)
      saveSemanticSearchConfig(updatedConfig)

      toast({
        title: "Semantic Search Target Created",
        description: `Target "${semanticFormData.name}" has been created`,
      })
    }

    resetSemanticForm()
  }

  const handleEditSemanticTarget = (target: SemanticSearchTarget) => {
    setEditingSemanticTarget(target)
    setSemanticFormData({
      name: target.name,
      codebasePath: target.codebasePath,
      maxResults: target.maxResults,
      description: target.description || "",
      isActive: target.isActive,
    })
    setShowSemanticForm(true)
  }

  const handleDeleteSemanticTarget = (target: SemanticSearchTarget) => {
    const updatedTargets = semanticSearchConfig.targets.filter((t) => t.id !== target.id)
    const updatedConfig = { ...semanticSearchConfig, targets: updatedTargets }
    setSemanticSearchConfig(updatedConfig)
    saveSemanticSearchConfig(updatedConfig)

    toast({
      title: "Semantic Search Target Deleted",
      description: `Target "${target.name}" has been deleted`,
    })
  }

  const handleToggleSemanticTargetActive = (target: SemanticSearchTarget) => {
    const updatedTarget = { ...target, isActive: !target.isActive }
    const updatedTargets = semanticSearchConfig.targets.map((t) =>
      t.id === target.id ? updatedTarget : t
    )
    const updatedConfig = { ...semanticSearchConfig, targets: updatedTargets }
    setSemanticSearchConfig(updatedConfig)
    saveSemanticSearchConfig(updatedConfig)

    toast({
      title: `Target ${updatedTarget.isActive ? 'Enabled' : 'Disabled'}`,
      description: `Target "${target.name}" has been ${updatedTarget.isActive ? 'enabled' : 'disabled'}`,
    })
  }

  const handleMoveSemanticTargetPriority = (target: SemanticSearchTarget, direction: 'up' | 'down') => {
    const currentPriority = target.priority
    const targetTarget = semanticSearchConfig.targets.find(t =>
      direction === 'up' ? t.priority === currentPriority - 1 : t.priority === currentPriority + 1
    )

    if (targetTarget) {
      const updatedTargets = semanticSearchConfig.targets.map(t => {
        if (t.id === target.id) return { ...t, priority: targetTarget.priority }
        if (t.id === targetTarget.id) return { ...t, priority: currentPriority }
        return t
      })

      const updatedConfig = { ...semanticSearchConfig, targets: updatedTargets }
      setSemanticSearchConfig(updatedConfig)
      saveSemanticSearchConfig(updatedConfig)

      toast({
        title: "Priority Updated",
        description: `Moved "${target.name}" ${direction}`,
      })
    }
  }

  const resetSemanticForm = () => {
    setEditingSemanticTarget(null)
    setShowSemanticForm(false)
    setSemanticFormData({
      name: "",
      codebasePath: "./",
      maxResults: 10,
      description: "",
      isActive: true,
    })
  }

  const handleCopySemanticTarget = (target: SemanticSearchTarget) => {
    setEditingSemanticTarget(null)
    setSemanticFormData({
      name: `${target.name} (Copy)`,
      codebasePath: target.codebasePath,
      maxResults: target.maxResults,
      description: target.description || "",
      isActive: target.isActive,
    })
    setShowSemanticForm(true)
  }

  const generationTemplates = templates.filter((t) => t.type === "generation")
  const modificationTemplates = templates.filter((t) => t.type === "modification")
  const instructionTypesTemplates = templates.filter((t) => t.type === "instruction-types")
  const expandTemplates = templates.filter((t) => t.type === "expand")

  const sortedModelConfigs = modelConfigs.sort((a, b) => a.priority - b.priority)
  const activeModelConfigs = getActiveModelsByPriority(modelConfigs)

  const ModelManagementSection = () => (
    <div className="space-y-6 pb-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">AI Model Configurations</h3>
          <p className="text-sm text-gray-600">
            Configure AI models with failover priority. Models are tried in order of priority.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRestoreDefaultModels}
            className="flex items-center gap-2"
          >
            <Settings2 className="w-4 h-4" />
            Restore Defaults
          </Button>
          <Button
            onClick={() => setShowModelForm(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Model
          </Button>
        </div>
      </div>

      {activeModelConfigs.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-800 mb-2">Active Failover Sequence:</h4>
          <div className="flex flex-wrap gap-2">
            {activeModelConfigs.map((config, index) => (
              <Badge key={config.id} variant="secondary" className="text-sm">
                {index + 1}. {config.model} ({config.provider})
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-1">
        {sortedModelConfigs.map((config) => (
          <Card
            key={config.id}
            className={`relative transition-all hover:shadow-md ${
              config.isActive ? "ring-2 ring-blue-500 bg-blue-50" : "bg-gray-50"
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-sm font-medium truncate">{config.name}</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {PROVIDER_INFO[config.provider]?.name || ''}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      Priority: {config.priority}
                    </Badge>
                    {config.id.startsWith('default-') && (
                      <Badge variant="default" className="text-xs">
                        Default
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setShowModelPreview(config)}
                  >
                    <Eye className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleCopyModelConfig(config)}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleMoveModelPriority(config, 'up')}
                    disabled={config.priority === 1}
                  >
                    <ArrowUp className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleMoveModelPriority(config, 'down')}
                    disabled={config.priority === Math.max(...modelConfigs.map(c => c.priority))}
                  >
                    <ArrowDown className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleEditModelConfig(config)}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-red-500 hover:text-red-700"
                    onClick={() => handleDeleteModelConfig(config)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-gray-600 mb-3">
                Model: {config.model}
              </p>
              <Button
                variant={config.isActive ? "default" : "outline"}
                size="sm"
                onClick={() => handleToggleModelActive(config)}
                className="w-full"
              >
                {config.isActive ? "Enabled" : "Disabled"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  const TemplateSection = ({
    title,
    description,
    templates,
    type,
    selectedTemplate,
  }: {
    title: string
    description: string
    templates: SystemMessageTemplate[]
    type: "generation" | "modification" | "instruction-types" | "expand"
    selectedTemplate?: SystemMessageTemplate | null
  }) => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
        <Button
          onClick={() => {
            setFormData({ ...formData, type })
            setShowForm(true)
          }}
          className="flex items-center gap-2"
          size="sm"
        >
          <Plus className="w-4 h-4" />
          New Template
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 p-1">
        {templates.map((template) => (
          <Card
            key={template.id}
            className={`relative transition-all hover:shadow-md ${
              selectedTemplate?.id === template.id
                ? `ring-2 ${type === "generation" ? "ring-blue-500 bg-blue-50" : 
                            type === "modification" ? "ring-green-500 bg-green-50" : 
                            type === "expand" ? "ring-orange-500 bg-orange-50" :
                            "ring-purple-500 bg-purple-50"}`
                : "hover:bg-gray-50"
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start gap-1">
                <div className="flex-1 min-w-0 pr-1">
                  <CardTitle className="text-sm font-medium truncate">{template.name}</CardTitle>
                  {template.isDefault && (
                    <span
                      className={`inline-block text-xs px-2 py-1 rounded-full mt-1 ${
                        type === "generation" ? "bg-blue-100 text-blue-700" : 
                        type === "modification" ? "bg-green-100 text-green-700" :
                        type === "expand" ? "bg-orange-100 text-orange-700" :
                        "bg-purple-100 text-purple-700"
                      }`}
                    >
                      Default
                    </span>
                  )}
                </div>
                <div className="flex flex-shrink-0">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowPreview(template)}>
                    <Eye className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleDuplicateTemplate(template)}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                  {!template.isDefault && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleEditTemplate(template)}
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                  )}
                  {!template.isDefault && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-500 hover:text-red-700"
                      onClick={() => handleDeleteTemplate(template)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-gray-600 mb-3 line-clamp-2">{template.description}</p>
              <Button
                variant={selectedTemplate?.id === template.id ? "default" : "outline"}
                size="sm"
                onClick={() => onTemplateSelect(template, type)}
                className="w-full"
              >
                {selectedTemplate?.id === template.id ? "Selected" : "Select"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-xl">Settings Manager</DialogTitle>
          <div className="flex gap-2 mt-4">
            <Button
              variant={activeTab === "templates" ? "default" : "outline"}
              onClick={() => setActiveTab("templates")}
              className="flex items-center gap-2"
            >
              <Settings2 className="w-4 h-4" />
              Templates
            </Button>
            <Button
              variant={activeTab === "models" ? "default" : "outline"}
              onClick={() => setActiveTab("models")}
              className="flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              AI Models
            </Button>
            <Button
              variant={activeTab === "settings" ? "default" : "outline"}
              onClick={() => setActiveTab("settings")}
              className="flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              Search Settings
            </Button>
            <Button
              variant={activeTab === "instruction-types" ? "default" : "outline"}
              onClick={() => setActiveTab("instruction-types")}
              className="flex items-center gap-2"
            >
              <Type className="w-4 h-4" />
              Instruction Types
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          {activeTab === "templates" ? (
            <div className="space-y-8 pb-4 px-2">
              <TemplateSection
                title="Test Generation Templates"
                description="Templates for creating new test instructions"
                templates={generationTemplates}
                type="generation"
                selectedTemplate={selectedGenerationTemplate}
              />

              <div className="border-t pt-8">
                <TemplateSection
                  title="Test Modification Templates"
                  description="Templates for modifying existing test instructions"
                  templates={modificationTemplates}
                  type="modification"
                  selectedTemplate={selectedModificationTemplate}
                />
              </div>

              <div className="border-t pt-8">
                <TemplateSection
                  title="Test Expansion Templates"
                  description="Templates for expanding test instructions into detailed steps"
                  templates={expandTemplates}
                  type="expand"
                  selectedTemplate={selectedExpandTemplate}
                />
              </div>
            </div>
          ) : activeTab === "models" ? (
            <div className="px-2">
              <ModelManagementSection />
            </div>
          ) : activeTab === "instruction-types" ? (
            <div className="space-y-8 pb-4 px-2">
              <TemplateSection
                title="Instruction Type Templates"
                description="Templates defining available instruction types for categorization"
                templates={instructionTypesTemplates}
                type="instruction-types"
                selectedTemplate={selectedInstructionTypesTemplate}
              />
            </div>
          ) : (
            <div className="px-2 py-4">
              <SearchSettings open={true} onOpenChange={() => {}} embedded={true} />
            </div>
          )}
        </ScrollArea>

        {/* Template Form Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>{editingTemplate ? "Edit Template" : "Create New Template"}</DialogTitle>
            </DialogHeader>

            <div className="overflow-y-auto flex-1 min-h-0">
              <div className="space-y-4 p-1">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Template Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter template name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="type">Template Type</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value: "generation" | "modification" | "instruction-types" | "expand") =>
                        setFormData({ ...formData, type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select template type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="generation">Generation Template</SelectItem>
                        <SelectItem value="modification">Modification Template</SelectItem>
                        <SelectItem value="expand">Expansion Template</SelectItem>
                        <SelectItem value="instruction-types">Instruction Types Template</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="orderMode">Order Mode</Label>
                    <Select
                      value={formData.orderMode}
                      onValueChange={(value: "ordered" | "unordered") =>
                        setFormData({ ...formData, orderMode: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select order mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ordered">Ordered - Instructions should follow a logical sequence</SelectItem>
                        <SelectItem value="unordered">Unordered - Instructions can be in any order</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="modelOverride">Model Override (Optional)</Label>
                  <Select
                    value={formData.modelOverride || "none"}
                    onValueChange={(value: string) =>
                      setFormData({ ...formData, modelOverride: value === "none" ? undefined : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Use global model config" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Use Global Model Config</SelectItem>
                      {sortedModelConfigs.map((config) => (
                        <SelectItem key={config.id} value={config.id}>
                          {config.name} ({config.provider} - {config.model})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    If set, this template will use the selected model first. If it fails, it will fall back to the global model priority list.
                  </p>
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of the template"
                  />
                </div>

                {formData.type === 'instruction-types' ? (
                  <div>
                    <Label>Available Instruction Types</Label>
                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <Input
                          value={newType}
                          onChange={(e) => setNewType(e.target.value)}
                          placeholder="Enter new instruction type"
                          onKeyDown={(e) => e.key === 'Enter' && handleAddType()}
                          className="flex-1"
                        />
                        <Button onClick={handleAddType} className="flex items-center gap-2">
                          <Plus className="w-4 h-4" />
                          Add
                        </Button>
                      </div>
                      
                      {editingTypes.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {editingTypes.map((type) => (
                            <Badge key={type} variant="outline" className="flex items-center gap-1">
                              {type}
                              <button
                                onClick={() => handleRemoveType(type)}
                                className="ml-1 hover:bg-red-100 rounded-full p-0.5"
                              >
                                <X className="w-3 h-3 text-red-500" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">No instruction types added yet.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="userMessage">Template Content</Label>
                    <Textarea
                      id="userMessage"
                      value={formData.userMessage}
                      onChange={(e) => setFormData({ ...formData, userMessage: e.target.value })}
                      placeholder="The main instruction content for the AI..."
                      className="min-h-[200px] font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Output format requirements are handled automatically by the API to ensure consistent JSON structure.
                    </p>
                  </div>
                )}

                {/* Semantic Search Targets Section */}
                <div className="border-t pt-4 mt-4">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex-1 min-w-0">
                      <Label className="text-base font-semibold">Semantic Search Targets</Label>
                      <p className="text-xs text-gray-500 mt-1">
                        Configure semantic search targets specific to this template
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddSemanticTarget(true)}
                      className="flex items-center gap-2 flex-shrink-0 ml-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Target
                    </Button>
                  </div>

                  {editingSemanticSearchTargets.length > 0 ? (
                    <div className="relative border rounded-md bg-gray-50">
                      <div className="h-[180px] overflow-y-auto overflow-x-hidden p-2 space-y-2">
                        {editingSemanticSearchTargets.map((target) => (
                          <Card key={target.id} className="p-3 bg-white">
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center gap-2">
                                  <h5 className="font-medium text-sm truncate" title={target.name}>
                                    {target.name}
                                  </h5>
                                  <Badge variant={target.isActive ? "default" : "secondary"} className="text-xs flex-shrink-0">
                                    {target.isActive ? "Active" : "Inactive"}
                                  </Badge>
                                </div>
                                <div className="text-xs text-gray-600 break-all">
                                  <span className="font-semibold">Path:</span>{" "}
                                  <span className="font-mono text-xs">{target.codebasePath}</span>
                                </div>
                                <div className="text-xs text-gray-600">
                                  <span className="font-semibold">Max Results:</span> {target.maxResults}
                                </div>
                                {target.description && (
                                  <p className="text-xs text-gray-500 mt-1">{target.description}</p>
                                )}
                              </div>
                              <div className="flex flex-col gap-1 flex-shrink-0">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleToggleSemanticTargetInTemplate(target.id)}
                                  title={target.isActive ? "Disable" : "Enable"}
                                >
                                  <Eye className={`w-3.5 h-3.5 ${target.isActive ? '' : 'opacity-50'}`} />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-500 hover:text-red-700"
                                  onClick={() => handleRemoveSemanticTargetFromTemplate(target.id)}
                                  title="Remove target"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-gray-50 rounded-md border border-dashed">
                      <p className="text-sm text-gray-500">No semantic search targets configured</p>
                      <p className="text-xs text-gray-400 mt-1">Click "Add Target" to create one</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-4 flex-shrink-0">
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button onClick={handleSaveTemplate}>{editingTemplate ? "Update Template" : "Create Template"}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Semantic Target to Template Dialog */}
        <Dialog open={showAddSemanticTarget} onOpenChange={setShowAddSemanticTarget}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Semantic Search Target</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="new-target-name">Target Name</Label>
                  <Input
                    id="new-target-name"
                    value={newSemanticTarget.name}
                    onChange={(e) => setNewSemanticTarget({ ...newSemanticTarget, name: e.target.value })}
                    placeholder="Enter target name"
                  />
                </div>

                <div>
                  <Label htmlFor="new-target-path">Codebase Path</Label>
                  {loadingCollections ? (
                    <Input
                      id="new-target-path"
                      value="Loading collections..."
                      disabled
                    />
                  ) : availableCollections.length > 0 ? (
                    <Select
                      value={newSemanticTarget.codebasePath}
                      onValueChange={(value: string) => setNewSemanticTarget({ ...newSemanticTarget, codebasePath: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a codebase" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCollections.map((collection) => (
                          <SelectItem key={collection.name} value={collection.path}>
                            {collection.path}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="new-target-path"
                      value={newSemanticTarget.codebasePath}
                      onChange={(e) => setNewSemanticTarget({ ...newSemanticTarget, codebasePath: e.target.value })}
                      placeholder="./src or /path/to/codebase"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="new-target-max-results">Maximum Results</Label>
                  <Input
                    id="new-target-max-results"
                    type="number"
                    min="1"
                    max="50"
                    value={newSemanticTarget.maxResults}
                    onChange={(e) => setNewSemanticTarget({ ...newSemanticTarget, maxResults: parseInt(e.target.value) || 10 })}
                  />
                </div>

                <div className="flex items-center space-x-2 pt-6">
                  <input
                    id="new-target-active"
                    type="checkbox"
                    checked={newSemanticTarget.isActive}
                    onChange={(e) => setNewSemanticTarget({ ...newSemanticTarget, isActive: e.target.checked })}
                  />
                  <Label htmlFor="new-target-active">Enable this target</Label>
                </div>
              </div>

              <div>
                <Label htmlFor="new-target-description">Description (Optional)</Label>
                <Input
                  id="new-target-description"
                  value={newSemanticTarget.description}
                  onChange={(e) => setNewSemanticTarget({ ...newSemanticTarget, description: e.target.value })}
                  placeholder="Brief description of this search target"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={() => setShowAddSemanticTarget(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddSemanticTargetToTemplate}>
                Add Target
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={!!showPreview} onOpenChange={() => setShowPreview(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Template Preview: {showPreview?.name}
              </DialogTitle>
            </DialogHeader>

            <div className="overflow-y-auto flex-1 min-h-0">
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2">Type:</h4>
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                        showPreview?.type === "generation" ? "bg-blue-100 text-blue-700" : 
                        showPreview?.type === "modification" ? "bg-green-100 text-green-700" :
                        showPreview?.type === "expand" ? "bg-orange-100 text-orange-700" :
                        "bg-purple-100 text-purple-700"
                      }`}
                    >
                      {showPreview?.type === "generation" ? "Generation Template" : 
                       showPreview?.type === "modification" ? "Modification Template" :
                       showPreview?.type === "expand" ? "Expansion Template" :
                       "Instruction Types Template"}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2">Order Mode:</h4>
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                        showPreview?.orderMode === "ordered" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {showPreview?.orderMode === "ordered" ? "Ordered" : "Unordered"}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2">Status:</h4>
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                        showPreview?.isDefault ? "bg-gray-100 text-gray-700" : "bg-purple-100 text-purple-700"
                      }`}
                    >
                      {showPreview?.isDefault ? "Default Template" : "Custom Template"}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-2">Description:</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                    {showPreview?.description || "No description provided"}
                  </p>
                </div>

                {showPreview?.modelOverride && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2">Model Override:</h4>
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-sm text-blue-800">
                        {modelConfigs.find(c => c.id === showPreview.modelOverride)?.name || 'Unknown Model'}
                        {' '}({modelConfigs.find(c => c.id === showPreview.modelOverride)?.provider} - {modelConfigs.find(c => c.id === showPreview.modelOverride)?.model})
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        This template will attempt to use this model first, then fall back to global config if it fails.
                      </p>
                    </div>
                  </div>
                )}

                {showPreview?.type === 'instruction-types' ? (
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2">Available Instruction Types:</h4>
                    <div className="flex flex-wrap gap-2">
                      {((showPreview as InstructionTypesTemplate)?.availableTypes || []).map((type) => (
                        <Badge key={type} variant="secondary" className="text-sm">
                          {type}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2">Template Content:</h4>
                    <pre className="text-sm bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono">
                      {showPreview?.userMessage || ""}
                    </pre>
                  </div>
                )}

                {/* Semantic Search Targets in Preview */}
                {showPreview?.semanticSearchTargets && showPreview.semanticSearchTargets.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2">Semantic Search Targets:</h4>
                    <div className="space-y-2">
                      {showPreview.semanticSearchTargets.map((target) => (
                        <div key={target.id} className="bg-gray-50 p-3 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <h5 className="font-medium text-sm">{target.name}</h5>
                            <Badge variant={target.isActive ? "default" : "secondary"} className="text-xs">
                              {target.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-600">
                            Path: <span className="font-mono">{target.codebasePath}</span> • Max results: {target.maxResults}
                          </p>
                          {target.description && (
                            <p className="text-xs text-gray-500 mt-1">{target.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-sm text-blue-800 mb-2">Note:</h4>
                  <p className="text-xs text-blue-700">
                    Output format requirements are automatically handled by the API routes to ensure consistent JSON
                    structure for the UI components.
                  </p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Model Configuration Form Dialog */}
        <Dialog open={showModelForm} onOpenChange={setShowModelForm}>
          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>{editingModelConfig ? "Edit Model Configuration" : "Add New Model Configuration"}</DialogTitle>
            </DialogHeader>

            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-4 p-1">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="modelName">Configuration Name</Label>
                    <Input
                      id="modelName"
                      value={modelFormData.name}
                      onChange={(e) => setModelFormData({ ...modelFormData, name: e.target.value })}
                      placeholder="Enter configuration name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="provider">Provider</Label>
                    <Select value={modelFormData.provider} onValueChange={handleModelProviderChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PROVIDER_INFO).map(([key, info]) => (
                          <SelectItem key={key} value={key}>
                            {info.name} - {info.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label htmlFor="modelName">Model</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => fetchModelsForProvider(modelFormData.provider, modelFormData.apiKey)}
                        disabled={loadingModels[modelFormData.provider]}
                        className="h-6 px-2 text-xs"
                      >
                        {loadingModels[modelFormData.provider] ? "Loading..." : "Refresh"}
                      </Button>
                    </div>
                    <Select
                      value={modelFormData.model}
                      onValueChange={handleModelChange}
                      disabled={loadingModels[modelFormData.provider]}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={loadingModels[modelFormData.provider] ? "Loading models..." : "Select model"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableModels[modelFormData.provider].length > 0 
                          ? availableModels[modelFormData.provider].map((model) => (
                              <SelectItem key={model.id} value={model.id}>
                                {model.name || model.id}
                              </SelectItem>
                            ))
                          : ""}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="apiKey">API Key</Label>
                    <Input
                      id="apiKey"
                      type="password"
                      value={modelFormData.apiKey}
                      onChange={(e) => setModelFormData({ ...modelFormData, apiKey: e.target.value })}
                      placeholder="Enter API key"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="baseUrl">Base URL (Optional)</Label>
                  <Input
                    id="baseUrl"
                    value={modelFormData.baseUrl}
                    onChange={(e) => setModelFormData({ ...modelFormData, baseUrl: e.target.value })}
                    placeholder="Leave empty for default"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="temperature">Temperature</Label>
                    <Input
                      id="temperature"
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      value={modelFormData.temperature}
                      onChange={(e) => setModelFormData({ ...modelFormData, temperature: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="maxTokens">Max Tokens</Label>
                    <Input
                      id="maxTokens"
                      type="number"
                      min="1"
                      value={modelFormData.maxTokens}
                      onChange={(e) => setModelFormData({ ...modelFormData, maxTokens: parseInt(e.target.value) || 4000 })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="timeout">Timeout (ms)</Label>
                    <Input
                      id="timeout"
                      type="number"
                      min="1000"
                      value={modelFormData.timeout}
                      onChange={(e) => setModelFormData({ ...modelFormData, timeout: parseInt(e.target.value) || 30000 })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="maxRetries">Max Retries</Label>
                    <Input
                      id="maxRetries"
                      type="number"
                      min="0"
                      max="10"
                      value={modelFormData.maxRetries}
                      onChange={(e) => setModelFormData({ ...modelFormData, maxRetries: parseInt(e.target.value) || 3 })}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    id="isActive"
                    type="checkbox"
                    checked={modelFormData.isActive}
                    onChange={(e) => setModelFormData({ ...modelFormData, isActive: e.target.checked })}
                  />
                  <Label htmlFor="isActive">Enable this configuration</Label>
                </div>
              </div>
            </ScrollArea>

            <div className="flex gap-2 justify-end mt-4 flex-shrink-0">
              <Button variant="outline" onClick={resetModelForm}>
                Cancel
              </Button>
              <Button onClick={handleSaveModelConfig}>
                {editingModelConfig ? "Update Configuration" : "Add Configuration"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Model Preview Dialog */}
        <Dialog open={!!showModelPreview} onOpenChange={() => setShowModelPreview(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Configuration Preview: {showModelPreview?.name}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-1">Provider:</h4>
                  <p className="text-sm">{(showModelPreview && PROVIDER_INFO[showModelPreview.provider]?.name) || ''}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-1">Model:</h4>
                  <p className="text-sm">{showModelPreview?.model}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-1">Priority:</h4>
                  <p className="text-sm">{showModelPreview?.priority}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-1">Status:</h4>
                  <Badge variant={showModelPreview?.isActive ? "default" : "secondary"}>
                    {showModelPreview?.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-1">Temperature:</h4>
                  <p className="text-sm">{showModelPreview?.temperature}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-1">Max Tokens:</h4>
                  <p className="text-sm">{showModelPreview?.maxTokens}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-1">Timeout:</h4>
                  <p className="text-sm">{showModelPreview?.timeout}ms</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-1">Max Retries:</h4>
                  <p className="text-sm">{showModelPreview?.maxRetries}</p>
                </div>
              </div>

              {showModelPreview?.baseUrl && (
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-1">Base URL:</h4>
                  <p className="text-sm font-mono bg-gray-100 p-2 rounded">{showModelPreview.baseUrl}</p>
                </div>
              )}

              {showModelPreview?.apiKey && (
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-1">API Key:</h4>
                  <p className="text-sm font-mono bg-gray-100 p-2 rounded">••••••••••••••••</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

      </DialogContent>
    </Dialog>
  )
}
