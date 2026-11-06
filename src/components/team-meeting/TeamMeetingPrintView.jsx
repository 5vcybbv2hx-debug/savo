import React, { useState, useRef } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Printer, X } from 'lucide-react';

const priorityLabel = { niedrig: 'NIEDRIG', normal: 'NORMAL', hoch: 'HOCH' };
const priorityColor = { niedrig: '#3b82f6', normal: '#94a3b8', hoch: '#ef4444' };

export default function TeamMeetingPrintView({ open, onClose, topics, schedule }) {
    const [checked, setChecked] = useState({});
    const printRef = useRef(null);

    const openTopics = topics.filter(t => !t.is_archived && t.status !== 'erledigt');
    const highPriority = openTopics.filter(t => t.priority === 'hoch');
    const normalTopics = openTopics.filter(t => t.priority === 'normal');
    const lowTopics = openTopics.filter(t => t.priority === 'niedrig');

    const toggle = (id) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));

    const handlePrint = () => {
        const content = printRef.current;
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`<style>@page{size:A4 portrait;margin:15mm}</style>
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Teamsitzung – ${schedule ? format(new Date(schedule.date), 'dd.MM.yyyy') : 'Agenda'}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        background: #0a0a0a;
                        color: #e2e8f0;
                        font-family: 'Courier New', monospace;
                        padding: 32px;
                    }
                    .page { max-width: 800px; margin: 0 auto; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 2px solid #00bcd4; padding-bottom: 20px; }
                    .logo { font-size: 52px; font-weight: 900; color: #00bcd4; letter-spacing: -4px; line-height: 1; }
                    .logo span { font-size: 13px; letter-spacing: 3px; display: block; color: #94a3b8; margin-top: 4px; }
                    .title-block { text-align: right; }
                    .title-block h1 { font-size: 32px; letter-spacing: 6px; color: #e2e8f0; text-transform: uppercase; }
                    .meta { margin-top: 8px; }
                    .meta p { font-size: 12px; color: #94a3b8; letter-spacing: 2px; margin: 2px 0; }
                    .meta .cyan { color: #00bcd4; }
                    .section { margin-bottom: 24px; }
                    .section-title { font-size: 13px; letter-spacing: 4px; text-transform: uppercase; color: #00bcd4; border-bottom: 1px solid #00bcd452; padding-bottom: 8px; margin-bottom: 12px; }
                    .topic-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; border-bottom: 1px solid #1e293b; }
                    .checkbox { width: 20px; height: 20px; border: 2px solid #00bcd4; border-radius: 3px; flex-shrink: 0; margin-top: 2px; display: flex; align-items: center; justify-content: center; }
                    .checkbox.checked { background: #00bcd4; }
                    .topic-content { flex: 1; }
                    .topic-title { font-size: 14px; font-weight: bold; color: #e2e8f0; letter-spacing: 1px; }
                    .topic-desc { font-size: 12px; color: #94a3b8; margin-top: 4px; line-height: 1.5; }
                    .topic-meta { font-size: 11px; color: #475569; margin-top: 6px; }
                    .priority-badge { font-size: 10px; letter-spacing: 2px; padding: 2px 8px; border-radius: 3px; font-weight: bold; }
                    .notes-box { margin-top: 6px; border: 1px dashed #334155; padding: 8px; border-radius: 4px; min-height: 40px; }
                    .notes-label { font-size: 10px; color: #475569; letter-spacing: 1px; margin-bottom: 4px; }
                    .footer { margin-top: 40px; border-top: 1px solid #334155; padding-top: 16px; text-align: center; font-size: 11px; color: #475569; letter-spacing: 2px; }
                    .count-badge { background: #00bcd420; border: 1px solid #00bcd460; color: #00bcd4; border-radius: 4px; padding: 2px 10px; font-size: 11px; display: inline-block; margin-left: 8px; }
                    @media print { body { background: #0a0a0a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
                </style>
            </head>
            <body>
                ${content.innerHTML}
            </body>
            </html>
        `);
        printWindow.document.close();
        setTimeout(() => { printWindow.print(); }, 400);
    };

    const TopicRow = ({ topic, showNotes = true }) => (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 0', borderBottom: '1px solid #1e293b' }}>
            <button
                onClick={() => toggle(topic.id)}
                style={{
                    width: 22, height: 22, border: `2px solid #00bcd4`,
                    borderRadius: 3, flexShrink: 0, marginTop: 3,
                    background: checked[topic.id] ? '#00bcd4' : 'transparent',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
            >
                {checked[topic.id] && <span style={{ color: '#000', fontSize: 14, fontWeight: 900 }}>✓</span>}
            </button>
            <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{
                        fontFamily: 'monospace', fontWeight: 700, fontSize: 14,
                        color: checked[topic.id] ? '#475569' : '#e2e8f0',
                        textDecoration: checked[topic.id] ? 'line-through' : 'none',
                        letterSpacing: '0.5px'
                    }}>
                        {topic.topic}
                    </span>
                    <span style={{
                        fontSize: 10, letterSpacing: 2, padding: '2px 8px',
                        borderRadius: 3, fontWeight: 700,
                        background: priorityColor[topic.priority] + '25',
                        color: priorityColor[topic.priority],
                        border: `1px solid ${priorityColor[topic.priority]}60`
                    }}>
                        {priorityLabel[topic.priority]}
                    </span>
                </div>
                {topic.description && (
                    <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 5, lineHeight: 1.6 }}>
                        {topic.description}
                    </p>
                )}
                <p style={{ fontSize: 11, color: '#475569', marginTop: 6, letterSpacing: 1 }}>
                    VON: {topic.employee_name?.toUpperCase()} · {format(new Date(topic.created_date), 'dd.MM.yyyy', { locale: de })}
                </p>
                {topic.manager_notes && (
                    <p style={{ fontSize: 12, color: '#00bcd4', marginTop: 5, fontStyle: 'italic' }}>
                        ↳ {topic.manager_notes}
                    </p>
                )}
                {showNotes && !checked[topic.id] && (
                    <div style={{ marginTop: 8, border: '1px dashed #334155', borderRadius: 4, padding: '6px 10px', minHeight: 36 }}>
                        <p style={{ fontSize: 10, color: '#475569', letterSpacing: 1 }}>NOTIZEN / BESCHLUSS:</p>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 bg-[#0a0a0a] border-[#00bcd4]/30">
                {/* Toolbar */}
                <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-[#111] border-b border-[#00bcd4]/30">
                    <span className="text-[#00bcd4] font-mono text-sm tracking-widest uppercase">Druckvorschau – Teamsitzung</span>
                    <div className="flex gap-2">
                        <Button onClick={handlePrint} size="sm" className="bg-[#00bcd4] hover:bg-[#00acc1] text-foreground font-bold tracking-widest text-xs">
                            <Printer className="w-4 h-4 mr-2" />
                            DRUCKEN / PDF
                        </Button>
                        <Button onClick={onClose} size="sm" variant="ghost" className="text-[#94a3b8] hover:text-white">
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Printable content */}
                <div ref={printRef} style={{ padding: '32px', fontFamily: "'Courier New', monospace", background: '#0a0a0a', color: '#e2e8f0' }}>

                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, borderBottom: '2px solid #00bcd4', paddingBottom: 20 }}>
                        <div>
                            <div style={{ fontSize: 52, fontWeight: 900, color: '#00bcd4', letterSpacing: -4, lineHeight: 1 }}>SAVO</div>
                            <div style={{ fontSize: 12, letterSpacing: 4, color: '#94a3b8', marginTop: 4 }}>LOUNGE • CLUB</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 28, letterSpacing: 6, color: '#e2e8f0', textTransform: 'uppercase', fontWeight: 700 }}>TEAMSITZUNG</div>
                            <div style={{ marginTop: 10, fontSize: 12, color: '#94a3b8', letterSpacing: 2 }}>
                                {schedule ? (
                                    <>
                                        <div>📅 TERMIN: {format(new Date(schedule.date), 'dd.MM.yyyy', { locale: de })}</div>
                                        <div style={{ color: '#00bcd4', marginTop: 4 }}>🕐 BEGINN: {schedule.time} UHR</div>
                                        {schedule.location && <div style={{ marginTop: 4 }}>📍 {schedule.location.toUpperCase()}</div>}
                                    </>
                                ) : (
                                    <div style={{ color: '#ef4444' }}>KEIN TERMIN FESTGELEGT</div>
                                )}
                            </div>
                            <div style={{ marginTop: 10, fontSize: 11, color: '#475569', letterSpacing: 1 }}>
                                ERSTELLT AM {format(new Date(), 'dd.MM.yyyy', { locale: de })} UM {format(new Date(), 'HH:mm', { locale: de })} UHR
                            </div>
                        </div>
                    </div>

                    {/* Stats */}
                    <div style={{ display: 'flex', gap: 16, marginBottom: 28 }}>
                        {[
                            { label: 'GESAMT OFFEN', value: openTopics.length, color: '#00bcd4' },
                            { label: 'HOHE PRIORITÄT', value: highPriority.length, color: '#ef4444' },
                            { label: 'NORMAL', value: normalTopics.length, color: '#94a3b8' },
                            { label: 'NIEDRIG', value: lowTopics.length, color: '#3b82f6' },
                        ].map(s => (
                            <div key={s.label} style={{ flex: 1, border: `1px solid ${s.color}40`, borderRadius: 6, padding: '10px 14px', background: `${s.color}08` }}>
                                <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
                                <div style={{ fontSize: 10, color: '#475569', letterSpacing: 2, marginTop: 2 }}>{s.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* High Priority */}
                    {highPriority.length > 0 && (
                        <div style={{ marginBottom: 28 }}>
                            <div style={{ fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', color: '#ef4444', borderBottom: '1px solid #ef444440', paddingBottom: 8, marginBottom: 12 }}>
                                ⚡ HOHE PRIORITÄT ({highPriority.length})
                            </div>
                            {highPriority.map(t => <TopicRow key={t.id} topic={t} />)}
                        </div>
                    )}

                    {/* Normal Priority */}
                    {normalTopics.length > 0 && (
                        <div style={{ marginBottom: 28 }}>
                            <div style={{ fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', color: '#00bcd4', borderBottom: '1px solid #00bcd430', paddingBottom: 8, marginBottom: 12 }}>
                                BESPRECHUNGSPUNKTE ({normalTopics.length})
                            </div>
                            {normalTopics.map(t => <TopicRow key={t.id} topic={t} />)}
                        </div>
                    )}

                    {/* Low Priority */}
                    {lowTopics.length > 0 && (
                        <div style={{ marginBottom: 28 }}>
                            <div style={{ fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', color: '#3b82f6', borderBottom: '1px solid #3b82f630', paddingBottom: 8, marginBottom: 12 }}>
                                WEITERE PUNKTE ({lowTopics.length})
                            </div>
                            {lowTopics.map(t => <TopicRow key={t.id} topic={t} />)}
                        </div>
                    )}

                    {openTopics.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569', letterSpacing: 2, fontSize: 13 }}>
                            KEINE OFFENEN THEMEN VORHANDEN
                        </div>
                    )}

                    {/* Footer */}
                    <div style={{ marginTop: 40, borderTop: '1px solid #1e293b', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: '#475569', letterSpacing: 2 }}>SAVO LOUNGE & CLUB • VERTRAULICH</span>
                        <span style={{ fontSize: 11, color: '#475569', letterSpacing: 2 }}>
                            {checked && Object.values(checked).filter(Boolean).length}/{openTopics.length} BESPROCHEN
                        </span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}