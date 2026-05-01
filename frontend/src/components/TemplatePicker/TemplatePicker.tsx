import React from 'react';
import { X, CheckSquare, ListTodo, List, ArrowRight, LayoutTemplate, PenTool, KanbanSquare, MessageSquare, PanelsTopLeft, GitFork, Lightbulb, RotateCcw, Shield, Map, Timer, Layers } from 'lucide-react';
import { Card } from '@/components';
import styles from './TemplatePicker.module.scss';

export type PickedTemplate = 'blank' | 'todo' | 'checklist' | 'list' | 'flow' | 'kanban' | 'meeting' | 'wireframe' | 'mindmap' | 'brainstorm' | 'retrospective' | 'swot' | 'storymap' | 'timeline' | 'architecture';

interface TemplatePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: PickedTemplate) => void;
}

type RawElement = Record<string, unknown>;

interface TemplateOption {
  id: PickedTemplate;
  label: string;
  description: string;
  icon: React.ElementType;
  elements: RawElement[];
}

function makeHandDrawnRect(x: number, y: number, w: number, h: number, text?: string, groupId?: string) {
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
    groupIds: groupId ? [groupId] : [],
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
  return Object.assign(box, {
    backgroundColor: checked ? '#a5eba8' : 'transparent',
    fillStyle: checked ? 'solid' : 'hachure',
    customData: {
      templateRole: 'checkbox',
      checked,
    },
  });
}

function makeAddButton(x: number, y: number, label: string, templateRole: string) {
  const btn = makeHandDrawnRect(x, y, 24, 24);
  return Object.assign(btn, {
    backgroundColor: '#d0ecff',
    fillStyle: 'solid',
    strokeColor: '#1971c2',
    roundness: { type: 3, value: 12 },
    customData: { templateRole, action: 'add', label },
  });
}

function makeArrow(x1: number, y1: number, x2: number, y2: number) {
  return {
    id: `arrow-${Math.random().toString(36).slice(2)}`,
    type: 'arrow',
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1,
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
    roundness: { type: 2 },
    seed: Math.floor(Math.random() * 10000),
    version: 2,
    versionNonce: Math.floor(Math.random() * 100000),
    isDeleted: false,
    boundElements: [],
    updated: Date.now(),
    link: null,
    locked: false,
    startBinding: null,
    endBinding: null,
    lastCommittedPoint: null,
    startArrowhead: null,
    endArrowhead: 'arrow',
    points: [
      [0, 0],
      [x2 - x1, y2 - y1],
    ],
  };
}

export const BUILTIN_TEMPLATES: Record<PickedTemplate, RawElement[]> = {
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
    makeAddButton(60, 250, '+', 'todo-add'),
    makeText(92, 250, 'Add task...', 16),
    makeHandDrawnRect(50, 290, 500, 2),
    makeText(60, 310, 'Notes:', 18),
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
    makeAddButton(60, 250, '+', 'checklist-add'),
    makeText(92, 250, 'Add item...', 16),
  ],
  list: [
    makeHandDrawnRect(50, 50, 500, 50),
    makeText(70, 65, 'Bullet List', 28),
    makeText(60, 130, '• First bullet point'),
    makeText(60, 170, '• Second bullet point'),
    makeText(60, 210, '• Third bullet point'),
    makeText(60, 250, '• Fourth item with details'),
    makeAddButton(60, 290, '+', 'list-add'),
    makeText(92, 290, 'Add bullet...', 16),
  ],
  flow: [
    makeHandDrawnRect(200, 50, 200, 60),
    makeText(230, 70, 'Start', 20),
    makeArrow(300, 110, 300, 150),
    makeHandDrawnRect(200, 150, 200, 60),
    makeText(220, 170, 'Process A', 20),
    makeArrow(300, 210, 300, 250),
    makeHandDrawnRect(200, 250, 200, 60),
    makeText(220, 270, 'Process B', 20),
    makeArrow(300, 310, 300, 350),
    makeHandDrawnRect(200, 350, 200, 60),
    makeText(230, 370, 'End', 20),
    makeAddButton(420, 180, '+', 'flow-add'),
    makeText(452, 180, 'Add step', 14),
  ],
  kanban: [
    makeText(50, 40, 'Kanban Board', 30),
    makeHandDrawnRect(50, 100, 180, 320),
    makeHandDrawnRect(260, 100, 180, 320),
    makeHandDrawnRect(470, 100, 180, 320),
    makeText(75, 120, 'Backlog', 20),
    makeText(285, 120, 'Doing', 20),
    makeText(495, 120, 'Done', 20),
    // Card 1 - grouped
    makeHandDrawnRect(70, 170, 140, 70, undefined, 'card1'),
    makeText(85, 190, 'User research', 16),
    // Card 2 - grouped
    makeHandDrawnRect(280, 170, 140, 70, undefined, 'card2'),
    makeText(295, 190, 'Sketch flow', 16),
    // Card 3 - grouped
    makeHandDrawnRect(490, 170, 140, 70, undefined, 'card3'),
    makeText(505, 190, 'Project brief', 16),
    // Add card buttons per column
    makeAddButton(110, 380, '+', 'kanban-add-backlog'),
    makeAddButton(320, 380, '+', 'kanban-add-doing'),
    makeAddButton(530, 380, '+', 'kanban-add-done'),
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
    makeAddButton(70, 430, '+', 'meeting-add-action'),
    makeText(102, 430, 'Add action...', 14),
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
    makeAddButton(480, 500, '+', 'wireframe-add-section'),
    makeText(512, 500, 'Add section', 14),
  ],
  mindmap: [
    makeHandDrawnRect(240, 200, 200, 70),
    makeText(275, 220, 'Main idea', 22),
    makeArrow(240, 235, 200, 108),
    makeHandDrawnRect(50, 80, 150, 55),
    makeText(75, 96, 'Research', 18),
    makeAddButton(50, 150, '+', 'mindmap-add-research'),
    makeArrow(440, 235, 490, 108),
    makeHandDrawnRect(490, 80, 150, 55),
    makeText(520, 96, 'Design', 18),
    makeAddButton(490, 150, '+', 'mindmap-add-design'),
    makeArrow(240, 270, 200, 377),
    makeHandDrawnRect(50, 350, 150, 55),
    makeText(80, 366, 'Build', 18),
    makeAddButton(50, 420, '+', 'mindmap-add-build'),
    makeArrow(440, 270, 490, 377),
    makeHandDrawnRect(490, 350, 150, 55),
    makeText(520, 366, 'Review', 18),
    makeAddButton(490, 420, '+', 'mindmap-add-review'),
  ],
  brainstorm: [
    makeText(50, 30, 'Brainstorm', 30),
    makeHandDrawnRect(220, 80, 240, 60),
    makeText(280, 100, 'Central Topic', 22),
    // Idea bubbles around
    makeHandDrawnRect(50, 180, 160, 50),
    makeText(70, 196, 'Idea 1', 18),
    makeArrow(210, 140, 130, 180),
    makeHandDrawnRect(280, 180, 160, 50),
    makeText(300, 196, 'Idea 2', 18),
    makeArrow(340, 140, 360, 180),
    makeHandDrawnRect(500, 180, 160, 50),
    makeText(520, 196, 'Idea 3', 18),
    makeArrow(460, 110, 580, 180),
    makeAddButton(50, 240, '+', 'brainstorm-add'),
    makeText(82, 240, 'Add idea...', 16),
    // Notes area
    makeHandDrawnRect(50, 280, 610, 100),
    makeText(70, 300, 'Notes & connections:', 18),
    makeText(70, 330, '- Write insights here', 16),
  ],
  retrospective: [
    makeText(50, 30, 'Retrospective', 30),
    // Went Well
    makeHandDrawnRect(50, 90, 200, 250),
    makeText(70, 110, 'Went Well ✓', 18),
    makeText(70, 150, '- Good thing 1', 16),
    makeText(70, 180, '- Good thing 2', 16),
    makeAddButton(70, 310, '+', 'retro-add-well'),
    // Improve
    makeHandDrawnRect(270, 90, 200, 250),
    makeText(290, 110, 'Improve ⚡', 18),
    makeText(290, 150, '- Issue 1', 16),
    makeText(290, 180, '- Issue 2', 16),
    makeAddButton(290, 310, '+', 'retro-add-improve'),
    // Actions
    makeHandDrawnRect(490, 90, 200, 250),
    makeText(510, 110, 'Actions →', 18),
    makeCheckbox(510, 150, false),
    makeText(540, 150, 'Action item 1', 16),
    makeCheckbox(510, 180, false),
    makeText(540, 180, 'Action item 2', 16),
    makeAddButton(510, 310, '+', 'retro-add-action'),
  ],
  swot: [
    makeText(50, 30, 'SWOT Analysis', 30),
    // Strengths
    makeHandDrawnRect(50, 90, 280, 180),
    makeText(70, 110, 'Strengths 💪', 20),
    makeText(70, 150, '- Advantage 1', 16),
    makeText(70, 180, '- Advantage 2', 16),
    makeAddButton(70, 240, '+', 'swot-add-strength'),
    // Weaknesses
    makeHandDrawnRect(350, 90, 280, 180),
    makeText(370, 110, 'Weaknesses ⚠️', 20),
    makeText(370, 150, '- Weakness 1', 16),
    makeText(370, 180, '- Weakness 2', 16),
    makeAddButton(370, 240, '+', 'swot-add-weakness'),
    // Opportunities
    makeHandDrawnRect(50, 290, 280, 180),
    makeText(70, 310, 'Opportunities 🔭', 20),
    makeText(70, 350, '- Opportunity 1', 16),
    makeText(70, 380, '- Opportunity 2', 16),
    makeAddButton(70, 440, '+', 'swot-add-opportunity'),
    // Threats
    makeHandDrawnRect(350, 290, 280, 180),
    makeText(370, 310, 'Threats 🛡️', 20),
    makeText(370, 350, '- Threat 1', 16),
    makeText(370, 380, '- Threat 2', 16),
    makeAddButton(370, 440, '+', 'swot-add-threat'),
  ],
  storymap: [
    makeText(50, 30, 'User Story Map', 30),
    // Epic row
    makeHandDrawnRect(50, 80, 600, 50),
    makeText(70, 96, 'Epic: User Journey', 20),
    // Steps row
    makeText(50, 160, 'Steps →', 14),
    makeHandDrawnRect(130, 150, 120, 40),
    makeText(145, 164, 'Step 1', 16),
    makeHandDrawnRect(270, 150, 120, 40),
    makeText(285, 164, 'Step 2', 16),
    makeHandDrawnRect(410, 150, 120, 40),
    makeText(425, 164, 'Step 3', 16),
    makeAddButton(550, 155, '+', 'storymap-add-step'),
    // Stories
    makeText(50, 220, 'Stories ↓', 14),
    makeHandDrawnRect(130, 210, 120, 35),
    makeText(140, 222, 'Story A', 14),
    makeHandDrawnRect(270, 210, 120, 35),
    makeText(280, 222, 'Story B', 14),
    makeHandDrawnRect(410, 210, 120, 35),
    makeText(420, 222, 'Story C', 14),
    makeAddButton(130, 255, '+', 'storymap-add-story'),
    // Priority labels
    makeHandDrawnRect(50, 300, 600, 2),
    makeText(50, 320, 'Priority: High → Low (top to bottom)', 14),
    makeAddButton(50, 350, '+', 'storymap-add-row'),
    makeText(82, 350, 'Add row...', 14),
  ],
  timeline: [
    makeText(50, 30, 'Project Timeline', 30),
    makeHandDrawnRect(50, 90, 600, 4),
    // Milestones
    makeHandDrawnRect(80, 70, 20, 44, undefined, 'milestone-1'),
    makeText(60, 125, 'Q1 Kickoff', 14),
    makeHandDrawnRect(220, 70, 20, 44, undefined, 'milestone-2'),
    makeText(200, 125, 'Design', 14),
    makeHandDrawnRect(360, 70, 20, 44, undefined, 'milestone-3'),
    makeText(340, 125, 'Build', 14),
    makeHandDrawnRect(500, 70, 20, 44, undefined, 'milestone-4'),
    makeText(480, 125, 'Launch', 14),
    // Tasks below timeline
    makeHandDrawnRect(50, 170, 130, 50),
    makeText(65, 185, 'Research', 14),
    makeHandDrawnRect(200, 170, 130, 50),
    makeText(215, 185, 'Prototype', 14),
    makeHandDrawnRect(350, 170, 130, 50),
    makeText(365, 185, 'Develop', 14),
    makeHandDrawnRect(500, 170, 130, 50),
    makeText(515, 185, 'Deploy', 14),
    makeAddButton(80, 240, '+', 'timeline-add'),
    makeText(112, 240, 'Add phase...', 14),
  ],
  architecture: [
    makeText(50, 30, 'System Architecture', 30),
    // Client
    makeHandDrawnRect(50, 90, 160, 70),
    makeText(90, 110, 'Client', 18),
    makeArrow(210, 125, 260, 125),
    // API Gateway
    makeHandDrawnRect(260, 90, 180, 70),
    makeText(290, 110, 'API Gateway', 18),
    makeArrow(440, 125, 490, 125),
    // Services
    makeHandDrawnRect(490, 90, 160, 70),
    makeText(520, 110, 'Services', 18),
    makeArrow(570, 160, 570, 200),
    // Database
    makeHandDrawnRect(490, 200, 160, 70),
    makeText(520, 220, 'Database', 18),
    // Cache
    makeHandDrawnRect(260, 200, 180, 70),
    makeText(300, 220, 'Cache', 18),
    makeArrow(440, 235, 490, 235),
    // CDN
    makeHandDrawnRect(50, 200, 160, 70),
    makeText(90, 220, 'CDN', 18),
    makeAddButton(300, 290, '+', 'architecture-add'),
    makeText(332, 290, 'Add component...', 14),
  ],
};

const OPTIONS: TemplateOption[] = [
  { id: 'blank', label: 'Blank Canvas', description: 'Start with an empty canvas', icon: PenTool, elements: [] },
  { id: 'todo', label: 'To-Do List', description: 'Checkbox tasks with add button', icon: ListTodo, elements: [] },
  { id: 'checklist', label: 'Checklist', description: 'Simple checklist with status', icon: CheckSquare, elements: [] },
  { id: 'list', label: 'Bullet List', description: 'Bulleted list with add button', icon: List, elements: [] },
  { id: 'flow', label: 'Flow Chart', description: 'Connected process with add step', icon: ArrowRight, elements: [] },
  { id: 'kanban', label: 'Kanban Board', description: 'Three columns with add cards', icon: KanbanSquare, elements: [] },
  { id: 'meeting', label: 'Meeting Notes', description: 'Agenda, decisions, actions', icon: MessageSquare, elements: [] },
  { id: 'wireframe', label: 'Wireframe', description: 'Editable page layout', icon: PanelsTopLeft, elements: [] },
  { id: 'mindmap', label: 'Mind Map', description: 'Central idea with + branches', icon: GitFork, elements: [] },
  { id: 'brainstorm', label: 'Brainstorm', description: 'Ideas around a central topic', icon: Lightbulb, elements: [] },
  { id: 'retrospective', label: 'Retrospective', description: 'Went well, improve, actions', icon: RotateCcw, elements: [] },
  { id: 'swot', label: 'SWOT Analysis', description: 'Strengths, weaknesses, opportunities, threats', icon: Shield, elements: [] },
  { id: 'storymap', label: 'User Story Map', description: 'Epics, steps, and stories', icon: Map, elements: [] },
  { id: 'timeline', label: 'Timeline', description: 'Project phases and milestones', icon: Timer, elements: [] },
  { id: 'architecture', label: 'Architecture', description: 'System components and connections', icon: Layers, elements: [] },
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
