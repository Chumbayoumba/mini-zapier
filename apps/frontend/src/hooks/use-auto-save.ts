'use client';

import { useEffect, useRef } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { useUpdateWorkflowSilent } from '@/hooks/use-workflows';

export function useAutoSave(workflowId: string) {
  const updateWorkflow = useUpdateWorkflowSilent();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let prev = {
      nodes: useEditorStore.getState().nodes,
      edges: useEditorStore.getState().edges,
      isDirty: useEditorStore.getState().isDirty,
    };

    const unsubscribe = useEditorStore.subscribe((state) => {
      const curr = { nodes: state.nodes, edges: state.edges, isDirty: state.isDirty };
      if (curr.nodes === prev.nodes && curr.edges === prev.edges && curr.isDirty === prev.isDirty) {
        return;
      }
      prev = curr;

      if (!curr.isDirty) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const { nodes, edges, isSaving } = useEditorStore.getState();
        if (isSaving) return;
        useEditorStore.getState().markSaving();
        updateWorkflow.mutateAsync({
          id: workflowId,
          definition: { nodes, edges },
        }).then(() => {
          useEditorStore.getState().markSaved();
        }).catch(() => {
          useEditorStore.setState({ isSaving: false });
        });
      }, 2000);
    });

    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [workflowId, updateWorkflow]);
}
