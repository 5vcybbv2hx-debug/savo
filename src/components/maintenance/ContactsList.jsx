import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import ContactCard from './ContactCard';
import ContactForm from './ContactForm';

export default function ContactsList({ contacts = [], onChange }) {
    const [editingId, setEditingId] = useState(null);
    const [isAdding, setIsAdding] = useState(false);

    const handleAddContact = (formData) => {
        const newContacts = [...contacts, formData];
        onChange(newContacts);
        setIsAdding(false);
    };

    const handleEditContact = (formData) => {
        const newContacts = contacts.map(c => c.id === formData.id ? formData : c);
        onChange(newContacts);
        setEditingId(null);
    };

    const handleDeleteContact = (id) => {
        const newContacts = contacts.filter(c => c.id !== id);
        onChange(newContacts);
    };

    const handleTogglePrimary = (id) => {
        const newContacts = contacts.map(c => ({
            ...c,
            is_primary: c.id === id ? !c.is_primary : false
        }));
        onChange(newContacts);
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-[13.5px] font-medium text-foreground tracking-tight">
                    Wartungsfirma / Kontakte
                </h3>
                {!isAdding && (
                    <Button
                        type="button"
                        onClick={() => setIsAdding(true)}
                        size="sm"
                        className="h-9"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Kontakt hinzufügen
                    </Button>
                )}
            </div>

            {/* Neuer Kontakt Form */}
            {isAdding && (
                <ContactForm
                    contact={null}
                    onSave={handleAddContact}
                    onCancel={() => setIsAdding(false)}
                    onTogglePrimary={() => {}}
                />
            )}

            {/* Kontakt bearbeiten */}
            {editingId && (
                <ContactForm
                    contact={contacts.find(c => c.id === editingId)}
                    onSave={handleEditContact}
                    onCancel={() => setEditingId(null)}
                    onTogglePrimary={() => handleTogglePrimary(editingId)}
                />
            )}

            {/* Kontakt-List */}
            {contacts.length > 0 && (
                <div className="space-y-3">
                    {contacts.map(contact => (
                        <ContactCard
                            key={contact.id}
                            contact={contact}
                            isPrimary={contact.is_primary}
                            onEdit={() => setEditingId(contact.id)}
                            onDelete={() => handleDeleteContact(contact.id)}
                        />
                    ))}
                </div>
            )}

            {/* Empty State */}
            {contacts.length === 0 && !isAdding && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                    Noch keine Kontakte hinzugefügt. Optional einen Kontakt hinzufügen für die Wartungsfirma.
                </div>
            )}
        </div>
    );
}