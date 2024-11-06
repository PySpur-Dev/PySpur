from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from ..schemas.workflow_schemas import (
    WorkflowCreateRequestSchema,
    WorkflowResponseSchema,
    WorkflowDefinitionSchema,
    WorkflowsListResponseSchema,
)
from ..database import get_db
from ..models.workflow_model import WorkflowModel as WorkflowModel

router = APIRouter()


@router.post(
    "/", response_model=WorkflowResponseSchema, description="Create a new workflow"
)
def create_workflow(
    workflow_request: WorkflowCreateRequestSchema, db: Session = Depends(get_db)
) -> WorkflowResponseSchema:
    new_workflow = WorkflowModel(
        name=workflow_request.name or "Untitled Workflow",
        description=workflow_request.description,
        definition=(workflow_request.definition.model_dump()),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(new_workflow)
    db.commit()
    db.refresh(new_workflow)
    return WorkflowResponseSchema(
        id=new_workflow.id,
        name=new_workflow.name,
        description=new_workflow.description,
        definition=WorkflowDefinitionSchema.model_validate(new_workflow.definition),
        created_at=new_workflow.created_at,
        updated_at=new_workflow.updated_at,
    )


@router.put(
    "/{workflow_id}/",
    response_model=WorkflowResponseSchema,
    description="Update a workflow",
)
def update_workflow(
    workflow_id: str,
    workflow_def: WorkflowDefinitionSchema,
    db: Session = Depends(get_db),
) -> WorkflowResponseSchema:
    workflow = db.query(WorkflowModel).filter(WorkflowModel.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    workflow.definition = workflow_def.model_dump()
    workflow.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(workflow)
    return WorkflowResponseSchema(
        id=workflow.id,
        name=workflow.name,
        description=workflow.description,
        definition=workflow_def,
        created_at=workflow.created_at,
        updated_at=workflow.updated_at,
    )


@router.get(
    "/", response_model=WorkflowsListResponseSchema, description="List all workflows"
)
def list_workflows(db: Session = Depends(get_db)) -> WorkflowsListResponseSchema:
    workflows = db.query(WorkflowModel).all()
    workflow_list = [
        WorkflowResponseSchema(
            id=wf.id,
            name=wf.name,
            description=wf.description,
            definition=wf.definition,
            created_at=wf.created_at,
            updated_at=wf.updated_at,
        )
        for wf in workflows
    ]
    return WorkflowsListResponseSchema(workflows=workflow_list)

@router.get(
    "/{workflow_id}/",
    response_model=WorkflowResponseSchema,
    description="Get a workflow by ID",
)
def get_workflow(workflow_id: str, db: Session = Depends(get_db)) -> WorkflowResponseSchema:
    workflow = db.query(WorkflowModel).filter(WorkflowModel.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return WorkflowResponseSchema(
        id=workflow.id,
        name=workflow.name,
        description=workflow.description,
        definition=workflow.definition,
        created_at=workflow.created_at,
        updated_at=workflow.updated_at,
    )