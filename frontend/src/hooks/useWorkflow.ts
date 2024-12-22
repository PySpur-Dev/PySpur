import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getRunStatus, startRun, getWorkflow } from '../utils/api';
import { clearCanvas, setProjectName } from '../store/canvasSlice';
import { setNodeRunData, setNodeTaskStatus } from '../store/nodeDataSlice';
import { RootState } from '../store/store';
import { TaskResponse, TaskStatus } from '../types/api_types/taskSchemas';

interface RunStatusResponse {
    id: string;
    status: TaskStatus;
    tasks: TaskResponse[];
}

const useWorkflow = () => {
    const dispatch = useDispatch();
    const nodes = useSelector((state: RootState) => state.canvas.nodes);
    const workflowId = useSelector((state: RootState) => state.canvas.workflowId);
    const nodeDataById = useSelector((state: RootState) => state.nodeData.nodeDataById);
    const projectName = useSelector((state: RootState) => state.canvas.projectName);
    const [isRunning, setIsRunning] = useState(false);

    const updateWorkflowStatus = async (runID: string): Promise<void> => {
        const checkStatusInterval = setInterval(async () => {
            try {
                const statusResponse: RunStatusResponse = await getRunStatus(runID);
                console.log('Status Response:', statusResponse);

                if (statusResponse.tasks) {
                    statusResponse.tasks.forEach((task) => {
                        const nodeId = task.node_id;
                        const outputs = task.outputs || {};
                        const nodeTaskStatus = task.status;

                        // Check if the task output or status is different from current node data
                        const currentNodeData = nodeDataById[nodeId];
                        const isOutputDifferent = JSON.stringify(outputs) !== JSON.stringify(currentNodeData?.run);
                        const isStatusDifferent = nodeTaskStatus !== currentNodeData?.taskStatus;

                        if (isOutputDifferent) {
                            dispatch(setNodeRunData({ nodeId, runData: outputs }));
                        }
                        if (isStatusDifferent) {
                            dispatch(setNodeTaskStatus({ nodeId, status: nodeTaskStatus }));
                        }
                    });
                }

                if (statusResponse.status !== 'RUNNING') {
                    setIsRunning(false);
                    clearInterval(checkStatusInterval);
                }
            } catch (error) {
                console.error('Error fetching workflow status:', error);
                clearInterval(checkStatusInterval);
            }
        }, 1000);
    };

    const handleRunWorkflow = async (inputValues: Record<string, any>): Promise<void> => {
        if (!workflowId) return;

        try {
            const result = await startRun(workflowId, inputValues, null, 'interactive');
            setIsRunning(true);
            updateWorkflowStatus(result.id);
        } catch (error) {
            console.error('Error starting workflow run:', error);
        }
    };

    const handleDownloadWorkflow = async (): Promise<void> => {
        if (!workflowId) return;

        try {
            const workflow = await getWorkflow(workflowId);
            const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${projectName.replace(/\s+/g, '_')}.json`;

            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading workflow:', error);
        }
    };

    return {
        isRunning,
        handleRunWorkflow,
        handleDownloadWorkflow,
        handleClearCanvas: () => {
            if (window.confirm('Are you sure you want to clear the canvas? This action cannot be undone.')) {
                dispatch(clearCanvas());
            }
        },
        handleProjectNameChange: (e: React.ChangeEvent<HTMLInputElement>) => {
            dispatch(setProjectName(e.target.value));
        }
    };
};

export default useWorkflow;