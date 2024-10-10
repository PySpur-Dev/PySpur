import React from 'react';
import BaseNode from './BaseNode';
import { useSelector, useDispatch } from 'react-redux';

function TextFieldsNode({ id }) {
  const dispatch = useDispatch();

  // Find the node data from the Redux state
  const node = useSelector((state) => state.flow.nodes.find((n) => n.id === id));

  const updateNodeData = (data) => {
    dispatch({ type: 'UPDATE_NODE_DATA', payload: { id, data } });
  };

  // ... rest of your component logic ...
}

export default TextFieldsNode;