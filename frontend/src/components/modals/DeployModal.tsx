import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Tabs,
  Tab,
  Card,
  CardBody,
  Code,
} from "@nextui-org/react";
import { RootState } from '../../store/store';

type SupportedLanguages = 'python' | 'javascript' | 'curl';

interface DeployModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  getApiEndpoint: () => string;
}

const DeployModal: React.FC<DeployModalProps> = ({ isOpen, onOpenChange, getApiEndpoint }) => {
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguages>('python');
  const nodes = useSelector((state: RootState) => state.canvas.nodes);
  const inputNode = nodes.find(node => node.type === 'InputNode');
  const nodeData = useSelector((state: RootState) => state.nodeData.nodeDataById[inputNode?.id || '']);
  const workflowInputVariables = nodeData?.config?.output_schema || {};

  // Create example request body with the actual input variables
  const exampleRequestBody = {
    inputs: Object.keys(workflowInputVariables).reduce((acc, key) => {
      acc[key] = `<${key}>`;
      return acc;
    }, {} as Record<string, string>)
  };

  const pythonCode = `import requests

api_endpoint = "${getApiEndpoint()}"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer <your_api_key>"
}

# Example request body with your workflow's input variables
data = ${JSON.stringify(exampleRequestBody, null, 4)}

response = requests.post(api_endpoint, json=data, headers=headers)
print(response.json())`;

  const javascriptCode = `const apiEndpoint = "${getApiEndpoint()}";
const headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer <your_api_key>"
};

// Example request body with your workflow's input variables
const data = ${JSON.stringify(exampleRequestBody, null, 2)};

fetch(apiEndpoint, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(data)
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));`;

  const curlCode = `curl -X POST "${getApiEndpoint()}" \\
     -H "Content-Type: application/json" \\
     -H "Authorization: Bearer <your_api_key>" \\
     -d '${JSON.stringify(exampleRequestBody)}'`;

  const getCode = () => {
    switch (selectedLanguage) {
      case 'python':
        return pythonCode;
      case 'javascript':
        return javascriptCode;
      case 'curl':
        return curlCode;
      default:
        return '';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="3xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              Deploy Workflow
            </ModalHeader>
            <ModalBody>
              <div className="text-small text-default-500 mb-4">
                Use the following code snippets to integrate your workflow into your application:
              </div>
              <Tabs
                selectedKey={selectedLanguage}
                onSelectionChange={(key) => setSelectedLanguage(key as SupportedLanguages)}
              >
                <Tab key="python" title="Python">
                  <Card>
                    <CardBody>
                      <Code>{pythonCode}</Code>
                    </CardBody>
                  </Card>
                </Tab>
                <Tab key="javascript" title="JavaScript">
                  <Card>
                    <CardBody>
                      <Code>{javascriptCode}</Code>
                    </CardBody>
                  </Card>
                </Tab>
                <Tab key="curl" title="cURL">
                  <Card>
                    <CardBody>
                      <Code>{curlCode}</Code>
                    </CardBody>
                  </Card>
                </Tab>
              </Tabs>
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                Close
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default DeployModal;