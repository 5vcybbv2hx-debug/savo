import React, { useState } from 'react';
import { PenTool } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PhotoUploader from './PhotoUploader';
import SketchCanvas from './SketchCanvas';
import AttachmentGallery from './AttachmentGallery';

function generateAttachmentId() {
    return 'att_' + Math.random().toString(36).slice(2, 10);
}

export default function AttachmentManager({ attachments = [], onChange, isLoading = false }) {
    const [showSketchCanvas, setShowSketchCanvas] = useState(false);

    const handlePhotoAdded = (photo) => {
        const newAttachment = {
            id: generateAttachmentId(),
            ...photo,
            created_at: new Date().toISOString(),
        };
        onChange([...attachments, newAttachment]);
    };

    const handleSketchAdded = (sketch) => {
        const newAttachment = {
            id: generateAttachmentId(),
            ...sketch,
            created_at: new Date().toISOString(),
        };
        onChange([...attachments, newAttachment]);
    };

    const handleDeleteAttachment = (attachmentId) => {
        onChange(attachments.filter((att) => att.id !== attachmentId));
    };

    return (
        <div className="space-y-3 p-4 bg-secondary/20 rounded-xl border border-border/40">
            {/* Existing Attachments */}
            <AttachmentGallery
                attachments={attachments}
                onDelete={handleDeleteAttachment}
                readOnly={false}
            />

            {/* Upload Buttons */}
            <div className="grid grid-cols-2 gap-2">
                <PhotoUploader onPhotoAdded={handlePhotoAdded} isLoading={isLoading} />
                <Button
                    onClick={() => setShowSketchCanvas(true)}
                    disabled={isLoading}
                    className="h-12 rounded-xl gap-2 bg-primary hover:bg-primary text-white font-semibold"
                >
                    <PenTool className="w-4 h-4" />
                    <span className="hidden sm:inline">Skizze</span>
                </Button>
            </div>

            {/* Sketch Canvas Modal */}
            <SketchCanvas
                open={showSketchCanvas}
                onClose={() => setShowSketchCanvas(false)}
                onSketchAdded={handleSketchAdded}
                isLoading={isLoading}
            />
        </div>
    );
}