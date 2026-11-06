import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Users, Phone, Mail, MessageSquare } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function ReservationForm({ onSuccess }) {
    const [formData, setFormData] = useState({
        customer_name: '',
        email: '',
        phone: '',
        date: '',
        time: '',
        guests: 2,
        notes: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // Erstelle Reservierung über Backend-Funktion
            const response = await base44.functions.invoke('createPublicReservation', formData);
            
            if (response.data.success) {
                onSuccess(response.data.reservation);
            } else {
                throw new Error(response.data.error || 'Fehler beim Erstellen der Reservierung');
            }
        } catch (error) {
            console.error('Fehler beim Erstellen der Reservierung:', error);
            alert('Es ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    return (
        <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle className="text-2xl">Tisch reservieren</CardTitle>
                <CardDescription>
                    Reservieren Sie jetzt Ihren Tisch. Wir bestätigen Ihre Reservierung in Kürze per E-Mail.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="customer_name">Name *</Label>
                            <Input
                                id="customer_name"
                                name="customer_name"
                                value={formData.customer_name}
                                onChange={handleChange}
                                required
                                placeholder="Ihr Name"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Telefon *</Label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="phone"
                                    name="phone"
                                    type="tel"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    required
                                    placeholder="+49 123 456789"
                                    className="pl-10"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">E-Mail *</Label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                placeholder="ihre@email.de"
                                className="pl-10"
                            />
                        </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="date">Datum *</Label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="date"
                                    name="date"
                                    type="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    required
                                    min={new Date().toISOString().split('T')[0]}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="time">Uhrzeit *</Label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="time"
                                    name="time"
                                    type="time"
                                    value={formData.time}
                                    onChange={handleChange}
                                    required
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="guests">Personen *</Label>
                            <div className="relative">
                                <Users className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="guests"
                                    name="guests"
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={formData.guests}
                                    onChange={handleChange}
                                    required
                                    className="pl-10"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Besondere Wünsche</Label>
                        <div className="relative">
                            <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                            <Textarea
                                id="notes"
                                name="notes"
                                value={formData.notes}
                                onChange={handleChange}
                                placeholder="z.B. Allergien, Kinderstuhl, Fensterplatz..."
                                className="pl-10 min-h-[100px]"
                            />
                        </div>
                    </div>

                    <Button 
                        type="submit" 
                        className="w-full bg-status-warn/70 hover:bg-status-warn/70 text-lg h-12"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Wird gesendet...' : 'Jetzt reservieren'}
                    </Button>

                    <p className="text-xs text-muted-foreground text-center">
                        * Pflichtfelder
                    </p>
                </form>
            </CardContent>
        </Card>
    );
}