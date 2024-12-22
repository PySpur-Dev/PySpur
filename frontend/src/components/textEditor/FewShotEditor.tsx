import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import TextEditor from './TextEditor';
import { updateNodeData } from '../../store/canvasSlice';
import { Button, Tabs, Tab } from "@nextui-org/react";
import _ from 'lodash';
import { RootState } from '../../store/store';

interface FewShotExample {
  input?: string;
  output?: string;
}

interface NodeData {
  config?: {
    few_shot_examples?: FewShotExample[];
  };
  [key: string]: any;
}

interface Node {
  id: string;
  data: NodeData;
}

interface InputOutputTabsProps {
  activeTab: 'input' | 'output';
  setActiveTab: (tab: 'input' | 'output') => void;
}

const InputOutputTabs: React.FC<InputOutputTabsProps> = ({ activeTab, setActiveTab }) => {
  return (
    <div className='mb-5'>
      <div className="flex w-full flex-col items-center">
        <Tabs
          aria-label="Input/Output Options"
          selectedKey={activeTab}
          onSelectionChange={(key) => setActiveTab(key as 'input' | 'output')}
        >
          <Tab key="input" title="Input" />
          <Tab key="output" title="Output" />
        </Tabs>
      </div>
    </div>
  );
};

interface FewShotEditorProps {
  nodeID: string;
  exampleIndex: number;
  onSave: () => void;
  onDiscard: () => void;
}

const FewShotEditor: React.FC<FewShotEditorProps> = ({ nodeID, exampleIndex, onSave, onDiscard }) => {
  const dispatch = useDispatch();
  const node = useSelector((state: RootState) =>
    state.flow.nodes.find((n: Node) => n.id === nodeID)
  );
  const [activeTab, setActiveTab] = useState<'input' | 'output'>('input');

  const handleContentChange = (content: string) => {
    // Use lodash's cloneDeep to deep clone the few_shot_examples array
    const updatedExamples = _.cloneDeep(node?.data?.config?.few_shot_examples || []);

    if (!updatedExamples[exampleIndex]) {
      updatedExamples[exampleIndex] = {};
    }

    // Update the content for the active tab (input/output)
    updatedExamples[exampleIndex][activeTab] = content;

    // Dispatch the updated data to Redux
    dispatch(updateNodeData({
      id: nodeID,
      data: {
        ...node?.data,
        config: {
          ...node?.data?.config,
          few_shot_examples: updatedExamples
        }
      }
    }));
  };

  return (
    <div className="w-full px-4 py-10 my-10">
      <InputOutputTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      <TextEditor
        key={`${activeTab}-${exampleIndex}`}
        content={node?.data?.config?.few_shot_examples?.[exampleIndex]?.[activeTab] || ''}
        setContent={handleContentChange}
        isEditable={true}
        fieldTitle={`Example ${exampleIndex + 1} ${activeTab}`}
      />

      <div className="mt-4">
        <Button
          onPress={onDiscard}
          color="primary"
          variant="flat"
        >
          Discard
        </Button>
        <Button
          onPress={onSave}
          color="primary"
          variant="solid"
        >
          Save
        </Button>
      </div>
    </div>
  );
};

export default FewShotEditor;
