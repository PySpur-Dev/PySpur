import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Tabs,
  Tab,
  Card,
  CardBody,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  useDisclosure,
} from "@nextui-org/react";
import { Icon } from '@iconify/react';
import { RootState } from '../../store/store';
import { v4 as uuidv4 } from 'uuid';
import { TestInput } from '../../store/nodeDataSlice';

interface RunModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onRun?: (inputValues: Record<string, any>) => void;
  onSave?: (testCase: TestInput) => void;
}

const RunModal: React.FC<RunModalProps> = ({ isOpen, onOpenChange, onRun, onSave }) => {
  const nodes = useSelector((state: RootState) => state.canvas.nodes);
  const testInputs = useSelector((state: RootState) => state.nodeData.testInputs || []);
  const inputNode = nodes.find(node => node.type === 'InputNode');
  const nodeData = useSelector((state: RootState) => state.nodeData.nodeDataById[inputNode?.id || '']);
  const workflowInputVariables = nodeData?.config?.output_schema || {};
  const workflowInputVariableNames = Object.keys(workflowInputVariables);

  const [selectedTab, setSelectedTab] = useState<string>("debug");
  const [inputValues, setInputValues] = useState<Record<string, any>>({});
  const [selectedRow, setSelectedRow] = useState<string | null>(null);

  useEffect(() => {
    if (testInputs.length > 0 && !selectedRow) {
      setSelectedRow(testInputs[0].id);
    }
  }, [testInputs, selectedRow]);

  const handleInputChange = (key: string, value: string) => {
    setInputValues(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleRun = () => {
    if (onRun) {
      if (selectedTab === "debug") {
        onRun(inputValues);
      } else if (selectedRow) {
        const testCase = testInputs.find(input => input.id === selectedRow);
        if (testCase) {
          const { id, ...values } = testCase;
          onRun(values);
        }
      }
    }
    onOpenChange(false);
  };

  const handleSave = () => {
    if (onSave) {
      const testCase: TestInput = {
        id: uuidv4(),
        ...inputValues
      };
      onSave(testCase);
    }
    setInputValues({});
  };

  const handleRowClick = (id: string) => {
    setSelectedRow(id);
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="2xl"
      scrollBehavior="inside"
      classNames={{
        base: "bg-background",
      }}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              Run Workflow
            </ModalHeader>
            <ModalBody>
              <Tabs
                selectedKey={selectedTab}
                onSelectionChange={(key) => setSelectedTab(key.toString())}
                aria-label="Run options"
              >
                <Tab key="debug" title="Debug">
                  <Card>
                    <CardBody>
                      {workflowInputVariableNames.map((key) => (
                        <div key={key} className="mb-4">
                          <Input
                            label={key}
                            value={inputValues[key] || ''}
                            onChange={(e) => handleInputChange(key, e.target.value)}
                            variant="bordered"
                          />
                        </div>
                      ))}
                      <div className="flex justify-end gap-2">
                        <Button
                          color="primary"
                          variant="flat"
                          onPress={handleSave}
                          startContent={<Icon icon="solar:save-line-duotone" />}
                        >
                          Save Test Case
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                </Tab>
                <Tab key="test" title="Test Cases">
                  <Card>
                    <CardBody>
                      <Table
                        aria-label="Test cases"
                        selectionMode="single"
                        selectedKeys={selectedRow ? [selectedRow] : []}
                        onRowAction={handleRowClick}
                      >
                        <TableHeader>
                          {workflowInputVariableNames.map((key) => (
                            <TableColumn key={key}>{key}</TableColumn>
                          ))}
                        </TableHeader>
                        <TableBody>
                          {testInputs.map((testCase) => (
                            <TableRow key={testCase.id}>
                              {workflowInputVariableNames.map((key) => (
                                <TableCell key={key}>{testCase[key]}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardBody>
                  </Card>
                </Tab>
              </Tabs>
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                Close
              </Button>
              <Button color="primary" onPress={handleRun}>
                Run
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default RunModal;