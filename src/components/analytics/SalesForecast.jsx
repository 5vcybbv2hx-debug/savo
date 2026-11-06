import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

export function SalesForecast({ salesData }) {
    // Calculate forecast based on historical data
    const calculateForecast = () => {
        if (!salesData || salesData.length < 7) {
            return { forecast: [], trend: 'insufficient_data' };
        }

        // Get last 4 weeks average
        const last4Weeks = salesData.slice(-28);
        const avgRevenue = last4Weeks.reduce((sum, day) => sum + (day.revenue || 0), 0) / 28;
        
        // Calculate weekly pattern
        const weekdayAverages = {};
        for (let i = 0; i < 7; i++) {
            const dayData = last4Weeks.filter((_, index) => index % 7 === i);
            weekdayAverages[i] = dayData.reduce((sum, day) => sum + (day.revenue || 0), 0) / dayData.length;
        }

        // Calculate trend (last week vs previous week)
        const lastWeek = last4Weeks.slice(-7).reduce((sum, day) => sum + (day.revenue || 0), 0);
        const previousWeek = last4Weeks.slice(-14, -7).reduce((sum, day) => sum + (day.revenue || 0), 0);
        const trendPercent = ((lastWeek - previousWeek) / previousWeek) * 100;
        
        // Generate 7-day forecast
        const forecast = [];
        const today = new Date();
        
        for (let i = 1; i <= 7; i++) {
            const futureDate = new Date(today);
            futureDate.setDate(today.getDate() + i);
            const dayOfWeek = futureDate.getDay();
            
            // Base forecast on weekday average with trend adjustment
            const baseForecast = weekdayAverages[dayOfWeek] || avgRevenue;
            const adjustedForecast = baseForecast * (1 + (trendPercent / 100));
            
            forecast.push({
                date: futureDate.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }),
                forecast: Math.round(adjustedForecast),
                lower: Math.round(adjustedForecast * 0.85),
                upper: Math.round(adjustedForecast * 1.15)
            });
        }

        return { 
            forecast, 
            trend: trendPercent > 5 ? 'up' : trendPercent < -5 ? 'down' : 'stable',
            trendPercent: Math.abs(trendPercent).toFixed(1),
            avgDaily: Math.round(avgRevenue),
            weeklyTotal: Math.round(forecast.reduce((sum, day) => sum + day.forecast, 0))
        };
    };

    const { forecast, trend, trendPercent, avgDaily, weeklyTotal } = calculateForecast();

    if (!forecast || forecast.length === 0) {
        return (
            <Card className="bg-card border-border">
                <CardHeader>
                    <CardTitle className="text-foreground">Umsatz-Prognose</CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Nicht genügend Daten für eine Prognose (mind. 7 Tage benötigt)
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Card className="bg-card border-border">
            <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-status-ok" />
                    7-Tage Umsatz-Prognose
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                    Basierend auf historischen Daten der letzten 4 Wochen
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-background/50 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                            <Calendar className="w-4 h-4" />
                            Ø Pro Tag
                        </div>
                        <div className="text-2xl font-bold text-foreground">{avgDaily}€</div>
                    </div>
                    
                    <div className="bg-background/50 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                            <DollarSign className="w-4 h-4" />
                            7-Tage Total
                        </div>
                        <div className="text-2xl font-bold text-foreground">{weeklyTotal}€</div>
                    </div>
                    
                    <div className="bg-background/50 rounded-lg p-4 col-span-2">
                        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                            {trend === 'up' ? (
                                <TrendingUp className="w-4 h-4 text-status-ok" />
                            ) : trend === 'down' ? (
                                <TrendingDown className="w-4 h-4 text-status-danger" />
                            ) : (
                                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                            )}
                            Trend
                        </div>
                        <div className={cn(
                            "text-2xl font-bold",
                            trend === 'up' ? "text-status-ok" : trend === 'down' ? "text-status-danger" : "text-muted-foreground"
                        )}>
                            {trend === 'up' ? '+' : trend === 'down' ? '-' : '±'}{trendPercent}%
                        </div>
                    </div>
                </div>

                {/* Chart */}
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={forecast}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis 
                                dataKey="date" 
                                stroke="#94a3b8" 
                                style={{ fontSize: '12px' }}
                            />
                            <YAxis 
                                stroke="#94a3b8" 
                                style={{ fontSize: '12px' }}
                                tickFormatter={(value) => `${value}€`}
                            />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: '#1e293b', 
                                    border: '1px solid #334155',
                                    borderRadius: '8px'
                                }}
                                labelStyle={{ color: '#e2e8f0' }}
                                formatter={(value) => [`${value}€`, '']}
                            />
                            <Line 
                                type="monotone" 
                                dataKey="upper" 
                                stroke="#34d399" 
                                strokeDasharray="5 5"
                                dot={false}
                                strokeWidth={1}
                            />
                            <Line 
                                type="monotone" 
                                dataKey="forecast" 
                                stroke="#60a5fa" 
                                strokeWidth={3}
                                dot={{ fill: '#60a5fa', r: 4 }}
                            />
                            <Line 
                                type="monotone" 
                                dataKey="lower" 
                                stroke="#f87171" 
                                strokeDasharray="5 5"
                                dot={false}
                                strokeWidth={1}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-status-ok/70 rounded"></div>
                        <span className="text-muted-foreground">Optimistisch (+15%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-primary/70 rounded"></div>
                        <span className="text-muted-foreground">Prognose</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-status-danger/70 rounded"></div>
                        <span className="text-muted-foreground">Konservativ (-15%)</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}