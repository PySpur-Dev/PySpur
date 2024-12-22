import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateNodeData } from '../../store/canvasSlice';
import { getRunStatus } from '../../utils/api';

interface NodeStatus {
    status: string;
    output: any; // You might want to make this more specific based on your actual output type
}

interface RunStatusResponse {
    outputs: {
        [key: string]: NodeStatus;
    };
}

interface WorkflowStatusUpdaterProps {
    runID: string;
}

interface RootState {
    flow: {
        nodes: any[]; // You might want to make this more specific based on your actual nodes type
    };
}

const WorkflowStatusUpdater: React.FC<WorkflowStatusUpdaterProps> = ({ runID }) => {
    const dispatch = useDispatch();
    const nodes = useSelector((state: RootState) => state.flow.nodes);

    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const response = await getRunStatus(runID);
                const outputs = response.outputs;

                // Iterate over the outputs from the backend
                for (const [nodeId, nodeStatus] of Object.entries(outputs)) {
                    dispatch(updateNodeData({
                        id: nodeId,
                        data: { status: nodeStatus.status, runoutput: nodeStatus.output }
                    }));
                }
            } catch (error) {
                console.error('Error fetching workflow status:', error);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [runID, dispatch]);

    return null; // This component doesn't render anything
};

export default WorkflowStatusUpdater;
