import { useState, useEffect } from 'react';
import { Button } from '@extension/ui';

interface WorkflowSettingsProps {
  isDarkMode: boolean;
}

interface WorkflowPattern {
  id: string;
  name: string;
  platform: string;
  applicationType: string;
  steps: WorkflowStep[];
  successRate: number;
  averageTime: number;
  createdAt: string;
  lastUsed: string;
  usageCount: number;
}

interface WorkflowStep {
  action: string;
  parameters: Record<string, any>;
  description: string;
  isAIRequired: boolean;
  fallbackAction?: string;
}

export function WorkflowSettings({ isDarkMode }: WorkflowSettingsProps) {
  const [workflows, setWorkflows] = useState<WorkflowPattern[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowPattern | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    try {
      const result = await chrome.storage.local.get('jobhuntllm_workflows');
      setWorkflows(result.jobhuntllm_workflows || []);
    } catch (error) {
      console.error('Failed to load workflows:', error);
    }
  };

  const deleteWorkflow = async (workflowId: string) => {
    try {
      const updatedWorkflows = workflows.filter(w => w.id !== workflowId);
      await chrome.storage.local.set({ jobhuntllm_workflows: updatedWorkflows });
      setWorkflows(updatedWorkflows);
      if (selectedWorkflow?.id === workflowId) {
        setSelectedWorkflow(null);
      }
    } catch (error) {
      console.error('Failed to delete workflow:', error);
    }
  };

  const duplicateWorkflow = async (workflow: WorkflowPattern) => {
    const newWorkflow: WorkflowPattern = {
      ...workflow,
      id: `${workflow.platform}_${workflow.applicationType}_${Date.now()}`,
      name: `${workflow.name} (Copy)`,
      createdAt: new Date().toISOString(),
      usageCount: 0,
      lastUsed: new Date().toISOString(),
    };

    const updatedWorkflows = [...workflows, newWorkflow];
    await chrome.storage.local.set({ jobhuntllm_workflows: updatedWorkflows });
    setWorkflows(updatedWorkflows);
  };

  const exportWorkflow = (workflow: WorkflowPattern) => {
    const dataStr = JSON.stringify(workflow, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `jobhuntllm-workflow-${workflow.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const containerClass = `max-w-6xl mx-auto p-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`;
  const cardClass = `p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-slate-800' : 'bg-white'}`;
  const buttonClass = `px-4 py-2 rounded-lg font-medium`;

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, string> = {
      linkedin: '💼',
      indeed: '🔍',
      glassdoor: '🏢',
      workday: '⚙️',
      greenhouse: '🌱',
      default: '📄',
    };
    return icons[platform.toLowerCase()] || icons.default;
  };

  return (
    <div className={containerClass}>
      <div className="flex justify-between items-center mb-8">
        <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Saved Workflows</h2>
        <div className="flex gap-3">
          <Button onClick={loadWorkflows} className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}>
            🔄 Refresh
          </Button>
        </div>
      </div>

      {workflows.length === 0 ? (
        <div className={cardClass}>
          <div className="text-center py-12">
            <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              No Workflows Saved Yet
            </h3>
            <p className={`mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Complete a job application and then say "save this workflow" to create your first automation pattern.
            </p>
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
              <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                💡 <strong>Pro Tip:</strong> After successfully applying to a job, use the command:
                <br />
                <code className="font-mono bg-blue-100 text-blue-800 px-2 py-1 rounded mt-2 inline-block">
                  "Save this as a LinkedIn Easy Apply workflow"
                </code>
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Workflow List */}
          <div className="lg:col-span-1">
            <div className={cardClass}>
              <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Your Workflows ({workflows.length})
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {workflows.map(workflow => (
                  <div
                    key={workflow.id}
                    onClick={() => setSelectedWorkflow(workflow)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedWorkflow?.id === workflow.id
                        ? isDarkMode
                          ? 'border-blue-500 bg-blue-900/20'
                          : 'border-blue-500 bg-blue-50'
                        : isDarkMode
                          ? 'border-slate-600 hover:border-slate-500'
                          : 'border-gray-200 hover:border-gray-300'
                    }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{getPlatformIcon(workflow.platform)}</span>
                      <span className="font-medium text-sm truncate">{workflow.name}</span>
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {workflow.platform} • {workflow.steps.length} steps
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      {workflow.successRate > 0.8 ? '🟢' : workflow.successRate > 0.6 ? '🟡' : '🔴'}
                      {Math.round(workflow.successRate * 100)}% • Used {workflow.usageCount}x
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Workflow Details */}
          <div className="lg:col-span-2">
            {selectedWorkflow ? (
              <div className={cardClass}>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {getPlatformIcon(selectedWorkflow.platform)} {selectedWorkflow.name}
                    </h3>
                    <div className="flex gap-4 text-sm">
                      <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                        Platform: <strong>{selectedWorkflow.platform}</strong>
                      </span>
                      <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                        Type: <strong>{selectedWorkflow.applicationType}</strong>
                      </span>
                      <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                        Created: <strong>{formatDate(selectedWorkflow.createdAt)}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => duplicateWorkflow(selectedWorkflow)}
                      className={`${buttonClass} bg-green-600 text-white hover:bg-green-700 text-sm`}>
                      📋 Copy
                    </Button>
                    <Button
                      onClick={() => exportWorkflow(selectedWorkflow)}
                      className={`${buttonClass} bg-purple-600 text-white hover:bg-purple-700 text-sm`}>
                      📤 Export
                    </Button>
                    <Button
                      onClick={() => deleteWorkflow(selectedWorkflow.id)}
                      className={`${buttonClass} bg-red-600 text-white hover:bg-red-700 text-sm`}>
                      🗑️ Delete
                    </Button>
                  </div>
                </div>

                {/* Workflow Stats */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                    <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {selectedWorkflow.steps.length}
                    </div>
                    <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Steps</div>
                  </div>
                  <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                    <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {Math.round(selectedWorkflow.successRate * 100)}%
                    </div>
                    <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Success Rate</div>
                  </div>
                  <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                    <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {formatTime(selectedWorkflow.averageTime)}
                    </div>
                    <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Avg Time</div>
                  </div>
                </div>

                {/* Workflow Steps */}
                <div>
                  <h4 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Workflow Steps
                  </h4>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {selectedWorkflow.steps.map((step, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border ${isDarkMode ? 'border-slate-600 bg-slate-700' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {index + 1}. {step.action}
                          </span>
                          <div className="flex gap-2">
                            {step.isAIRequired ? (
                              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                                🧠 AI Required
                              </span>
                            ) : (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                ⚡ Fast Execute
                              </span>
                            )}
                            {step.fallbackAction && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                🔄 Has Fallback
                              </span>
                            )}
                          </div>
                        </div>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {step.description}
                        </p>
                        {step.fallbackAction && (
                          <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                            💡 Fallback: {step.fallbackAction}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Usage Instructions */}
                <div className={`mt-6 p-4 rounded-lg ${isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50'}`}>
                  <h5 className={`font-semibold mb-2 ${isDarkMode ? 'text-blue-300' : 'text-blue-900'}`}>
                    🚀 How to Use This Workflow
                  </h5>
                  <div className={`text-sm space-y-1 ${isDarkMode ? 'text-blue-200' : 'text-blue-800'}`}>
                    <p>
                      <strong>Fast Mode (No AI):</strong>
                    </p>
                    <code className="block bg-blue-100 text-blue-900 p-2 rounded mt-1 font-mono text-xs">
                      "Execute workflow {selectedWorkflow.id} without AI"
                    </code>
                    <p className="mt-2">
                      <strong>Smart Mode (With AI):</strong>
                    </p>
                    <code className="block bg-blue-100 text-blue-900 p-2 rounded mt-1 font-mono text-xs">
                      "Execute workflow {selectedWorkflow.id} with AI for custom content"
                    </code>
                  </div>
                </div>
              </div>
            ) : (
              <div className={cardClass}>
                <div className="text-center py-12">
                  <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Select a Workflow
                  </h3>
                  <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                    Choose a workflow from the list to view its details and execution steps.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
