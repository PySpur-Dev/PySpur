import React, { useState, useMemo } from 'react';
import { Card, Button } from '@nextui-org/react';
import { Icon } from '@iconify/react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../../store/store';
import { deleteEdgesBySource } from '../../../store/canvasSlice';

interface MergeEditorProps {
  branchRefs: string[];
  onChange: (branchRefs: string[]) => void;
  nodeId: string;
}

interface Node {
  id: string;
  data: {
    config?: {
      title?: string;
    };
  };
}

const MergeEditor: React.FC<MergeEditorProps> = ({ branchRefs, onChange, nodeId }) => {
  const dispatch = useDispatch();
  const edges = useSelector((state: RootState) => state.flow.edges);
  const nodes = useSelector((state: RootState) => state.flow.nodes) as Node[];

  // Get incoming branches based on connected edges, ensuring uniqueness
  const connectedBranches = useMemo(() => {
    const branchMap = new Map();

    edges
      .filter(edge => edge.target === nodeId)
      .forEach(edge => {
        const sourceNode = nodes.find(node => node.id === edge.source);
        if (!branchMap.has(edge.source)) {
          branchMap.set(edge.source, {
            id: edge.source,
            sourceHandle: edge.sourceHandle,
            label: sourceNode?.data?.config?.title || sourceNode?.id || 'Unknown Source'
          });
        }
      });

    return Array.from(branchMap.values());
  }, [edges, nodes, nodeId]);

  const handleRemoveBranch = (branchId: string) => {
    // Remove the branch from branchRefs
    const updatedRefs = branchRefs.filter(ref => ref !== branchId);
    onChange(updatedRefs);

    // Remove all edges from this source node
    dispatch(deleteEdgesBySource({ sourceId: branchId }));
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-semibold">Connected Branches ({connectedBranches.length})</h3>
        </div>
        {connectedBranches.length === 0 ? (
          <div className="text-xs text-default-400 italic p-2 border border-dashed border-default-200 rounded-md text-center">
            Connect branches to continue the flow
          </div>
        ) : (
          connectedBranches.map((branch) => (
            <div key={branch.id} className="flex items-center justify-between p-2 bg-default-100 rounded-md mb-2">
              <span className="text-sm font-medium">{branch.label}</span>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                color="danger"
                onClick={() => handleRemoveBranch(branch.id)}
              >
                <Icon icon="solar:trash-bin-trash-linear" width={20} />
              </Button>
            </div>
          ))
        )}
      </Card>
    </div>
  );
};

export default MergeEditor;
