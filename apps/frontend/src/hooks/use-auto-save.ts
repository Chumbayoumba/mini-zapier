'use client';

import { useEffect, useRef } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { useUpdateWorkflowSilent } from '@/hooks/use-workflows';

export function useAutoSave(workflowId: string) {
  const updateWorkflow = useUpdateWorkflowSilent();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = useEditorStore.subscribe(
      (state) => ({ nodes: state.nodes, edges: state.edges, isDirty: state.isDirty }),
      (curr) => {
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
      },
      { equalityFn: (a, b) => a.nodes === b.nodes && a.edges === b.edges && a.isDirty === b.isDirty },
    );

    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [workflowId, updateWorkflow]);
}
