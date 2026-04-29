import React from 'react';
import { X, CheckSquare, ListTodo, List, ArrowRight, LayoutTemplate, PenTool, KanbanSquare, MessageSquare, PanelsTopLeft, GitFork } from 'lucide-react';
import { Card } from '@/components';
import styles from './TemplatePicker.module.scss';

export type PickedTemplate = 'blank' | 'todo' | 'checklist' | 'list' | 'flow' | 'kanban' | 'meeting' | 'wireframe' | 'mindmap';

interface TemplatePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: PickedTemplate) => void;
}

interface TemplateOption {
  id: PickedTemplate;
  label: string;
  description: string;
  icon: React.ElementType;
  elements: any[];
}

function makeHandDrawnRect(x: number, y: number, w: number, h: number, text?: string) {
  return {
    id: `el-${Math.random().toString(36).slice(2)}`,
    type: 'rectangle',
    x, y, width: w, height: h,
    angle: 0,
    strokeColor: '#1e1e1e',
    backgroundColor: 'transparent',
    fillStyle: 'hachure',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: { type: 3, value: 32 },
    seed: Math.floor(Math.random() * 10000),
    version: 2,
    versionNonce: Math.floor(Math.random() * 100000),
    isDeleted: false,
    boundElements: text ? [{ id: `txt-${Math.random().toString(36).slice(2)}`, type: 'text' }] : [],
    updated: Date.now(),
    link: null,
    locked: false,
  };
}

function makeText(x: number, y: number, text: string, fontSize = 20) {
  return {
    id: `txt-${Math.random().toString(36).slice(2)}`,
    type: 'text',
    x, y, width: text.length * (fontSize * 0.55), height: fontSize * 1.4,
    angle: 0,
    strokeColor: '#1e1e1e',
    backgroundColor: 'transparent',
    fillStyle: 'hachure',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: Math.floor(Math.random() * 10000),
    version: 2,
    versionNonce: Math.floor(Math.random() * 100000),
    isDeleted: false,
    boundElements: [],
    updated: Date.now(),
    link: null,
    locked: false,
    text,
    fontSize,
    fontFamily: 1,
    textAlign: 'left',
    verticalAlign: 'top',
    baseline: 18,
    containerId: null,
    originalText: text,
    lineHeight: 1.25,
  };
}

function makeCheckbox(x: number, y: number, checked = false) {
  const box = makeHandDrawnRect(x, y, 20, 20);
  (box as any).backgroundColor = checked ? '#a5eba8' : 'transparent';
  (box as any).customData = {
    templateRole: 'checkbox',
    checked,
  };
  return box;
}

export const BUILTIN_TEMPLATES: Record<PickedTemplate, any[]> = {
  blank: [],
  todo: [
    makeHandDrawnRect(50, 50, 500, 50),
    makeText(70, 65, 'To-Do List', 28),
    makeCheckbox(60, 130, false),
    makeText(90, 130, 'First task'),
    makeCheckbox(60, 170, false),
    makeText(90, 170, 'Second task'),
    makeCheckbox(60, 210, false),
    makeText(90, 210, 'Third task'),
    makeHandDrawnRect(50, 280, 500, 2),
    makeText(60, 300, 'Notes:', 18),
  ],
  checklist: [
    makeHandDrawnRect(50, 50, 500, 50),
    makeText(70, 65, 'Checklist', 28),
    makeCheckbox(60, 130, true),
    makeText(90, 130, 'Completed item', 18),
    makeCheckbox(60, 170, false),
    makeText(90, 170, 'Pending item', 18),
    makeCheckbox(60, 210, false),
    makeText(90, 210, 'Another task', 18),
    makeHandDrawnRect(60, 250, 480, 1),
    makeText(70, 265, 'Add more items below', 14),
  ],
  list: [
    makeHandDrawnRect(50, 50, 500, 50),
    makeText(70, 65, 'Bullet List', 28),
    makeText(60, 130, '- First bullet point'),
    makeText(60, 170, '- Second bullet point'),
    makeText(60, 210, '- Third bullet point'),
    makeText(60, 250, '- Fourth item with details'),
    makeHandDrawnRect(50, 300, 500, 2),
    makeText(60, 320, 'Add your own items...', 14),
  ],
  flow: [
    makeHandDrawnRect(200, 50, 200, 60),
    makeText(230, 70, 'Start', 20),
    makeHandDrawnRect(200, 150, 200, 60),
    makeText(220, 170, 'Process A', 20),
    makeHandDrawnRect(200, 250, 200, 60),
    makeText(220, 270, 'Process B', 20),
    makeHandDrawnRect(200, 350, 200, 60),
    makeText(230, 370, 'End', 20),
  ],
  kanban: [
    makeText(50, 40, 'Kanban Board', 30),
    makeHandDrawnRect(50, 100, 180, 320),
    makeHandDrawnRect(260, 100, 180, 320),
    makeHandDrawnRect(470, 100, 180, 320),
    makeText(75, 120, 'Backlog', 20),
    makeText(285, 120, 'Doing', 20),
    makeText(495, 120, 'Done', 20),
    makeHandDrawnRect(70, 170, 140, 70),
    makeText(85, 190, 'User research', 16),
    makeHandDrawnRect(280, 170, 140, 70),
    makeText(295, 190, 'Sketch flow', 16),
    makeHandDrawnRect(490, 170, 140, 70),
    makeText(505, 190, 'Project brief', 16),
  ],
  meeting: [
    makeText(50, 40, 'Meeting Notes', 30),
    makeHandDrawnRect(50, 100, 560, 70),
    makeText(70, 120, 'Agenda', 20),
    makeText(70, 150, '- Topic one'),
    makeHandDrawnRect(50, 200, 560, 100),
    makeText(70, 220, 'Decisions', 20),
    makeText(70, 250, '- Decision made'),
    makeHandDrawnRect(50, 330, 560, 120),
    makeText(70, 350, 'Action Items', 20),
    makeCheckbox(70, 390, false),
    makeText(105, 390, 'Owner and next step', 18),
  ],
  wireframe: [
    makeText(50, 35, 'Page Wireframe', 30),
    makeHandDrawnRect(50, 90, 620, 60),
    makeText(75, 110, 'Navigation', 18),
    makeHandDrawnRect(50, 180, 280, 170),
    makeText(75, 205, 'Hero copy', 22),
    makeHandDrawnRect(360, 180, 310, 170),
    makeText(385, 205, 'Preview area', 22),
    makeHandDrawnRect(50, 380, 190, 110),
    makeHandDrawnRect(265, 380, 190, 110),
    makeHandDrawnRect(480, 380, 190, 110),
  ],
  mindmap: [
    makeHandDrawnRect(240, 200, 200, 70),
    makeText(275, 220, 'Main idea', 22),
    makeHandDrawnRect(50, 80, 150, 55),
    makeText(75, 96, 'Research', 18),
    makeHandDrawnRect(490, 80, 150, 55),
    makeText(520, 96, 'Design', 18),
    makeHandDrawnRect(50, 350, 150, 55),
    makeText(80, 366, 'Build', 18),
    makeHandDrawnRect(490, 350, 150, 55),
    makeText(520, 366, 'Review', 18),
  ],
};

const OPTIONS: TemplateOption[] = [
  { id: 'blank', label: 'Blank Canvas', description: 'Start with an empty canvas', icon: PenTool, elements: [] },
  { id: 'todo', label: 'To-Do List', description: 'Checkbox tasks with a title', icon: ListTodo, elements: [] },
  { id: 'checklist', label: 'Checklist', description: 'Simple checklist with status', icon: CheckSquare, elements: [] },
  { id: 'list', label: 'Bullet List', description: 'Bulleted list with notes area', icon: List, elements: [] },
  { id: 'flow', label: 'Flow Chart', description: 'Simple process flow diagram', icon: ArrowRight, elements: [] },
  { id: 'kanban', label: 'Kanban Board', description: 'Three editable work columns', icon: KanbanSquare, elements: [] },
  { id: 'meeting', label: 'Meeting Notes', description: 'Agenda, decisions, actions', icon: MessageSquare, elements: [] },
  { id: 'wireframe', label: 'Wireframe', description: 'Editable page layout', icon: PanelsTopLeft, elements: [] },
  { id: 'mindmap', label: 'Mind Map', description: 'Branching idea map', icon: GitFork, elements: [] },
];

export const TemplatePicker: React.FC<TemplatePickerProps> = ({ isOpen, onClose, onSelect }) => {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="template-title" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 id="template-title"><LayoutTemplate size={20} /> Choose a Template</h2>
          <button onClick={onClose} className={styles.closeBtn} aria-label="Close"><X size={18} /></button>
        </div>
        <div className={styles.grid}>
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <Card key={opt.id} className={styles.card} hover onClick={() => onSelect(opt.id)} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(opt.id); }}>
                <div className={styles.iconWrap}><Icon size={32} /></div>
                <h3 className={styles.title}>{opt.label}</h3>
                <p className={styles.desc}>{opt.description}</p>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};
