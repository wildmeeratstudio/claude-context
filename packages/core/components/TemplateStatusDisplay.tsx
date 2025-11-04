import { type SystemMessageTemplate, type InstructionTypesTemplate } from "@/lib/types/templateTypes"
import { type SemanticSearchConfig } from "@/lib/types/semanticSearchTypes"

interface TemplateStatusDisplayProps {
  label: string
  template?: SystemMessageTemplate | InstructionTypesTemplate | null
  semanticSearchConfig?: SemanticSearchConfig | null
  colorClass?: string
  maxWidth?: string
}

export function TemplateStatusDisplay({
  label,
  template,
  semanticSearchConfig,
  colorClass = "bg-gray-400",
  maxWidth = "max-w-[100px]"
}: TemplateStatusDisplayProps) {
  const getTooltipText = () => {
    if (semanticSearchConfig) {
      const activeTargets = semanticSearchConfig.targets.filter(t => t.isActive)
      const targetsList = activeTargets
        .map(t => `${t.name}: ${t.codebasePath} (${t.maxResults} results)`)
        .join('\n')
      return `Semantic Search Configuration\n\nActive Targets:\n${targetsList || 'No active targets'}\n\nGlobal Status: ${semanticSearchConfig.globalEnabled ? 'Enabled' : 'Disabled'}`
    }

    if (!template) return 'No configuration available'

    const baseText = `${template.description || template.name}`

    if (template.type === 'instruction-types') {
      const typesTemplate = template as InstructionTypesTemplate
      return `${baseText}\n\nAvailable Types: ${typesTemplate.availableTypes.join(', ')}`
    }

    return `${baseText}\n\nTemplate Content:\n${template.userMessage}`
  }

  const getDisplayText = () => {
    if (semanticSearchConfig) {
      const activeTargets = semanticSearchConfig.targets.filter(t => t.isActive)
      return `${activeTargets.length} active target${activeTargets.length !== 1 ? 's' : ''}`
    }

    if (!template) return 'Not configured'

    if (template.type === 'instruction-types') {
      const typesTemplate = template as InstructionTypesTemplate
      return `${typesTemplate.availableTypes.length} types (${template.name})`
    }

    return template.name || template.description
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
        <div className={`w-2 h-2 ${colorClass} rotate-45`}></div>
        <span className="font-medium text-gray-600">{label}:</span>
        <span
          className={`text-gray-700 font-semibold ${maxWidth} truncate cursor-help`}
          title={getTooltipText()}
        >
          {getDisplayText()}
        </span>
      </div>
    </div>
  )
}