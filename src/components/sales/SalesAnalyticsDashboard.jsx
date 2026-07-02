import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Award, AlertTriangle, Calendar, Filter, X } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, ZAxis } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const COLORS = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function SalesAnalyticsDashboard() {
    const [timeRange, setTimeRange] = useState('365');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('all');
    const [drilldownItem, setDrilldownItem] = useState(null);

    const { data: reports = [] } = useQuery({
        queryKey: ['sales-reports'],
        queryFn: () => base44.entities.SalesReport.filter({ processing_status: 'completed' }, '-report_date'),
        placeholderData: []
    });

    const { data: salesData = [] } = useQuery({
        queryKey: ['sales-data'],
        queryFn: () => base44.entities.SalesDataItem.list('-date', 1000),
        placeholderData: []
    });

    // Filter data by time range and other criteria
    const filteredReports = useMemo(() => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - parseInt(timeRange));
        let filtered = reports.filter(r => new Date(r.report_date) >= cutoffDate);
        
        // Filter by payment method if selected
        if (selectedPaymentMethod !== 'all' && selectedPaymentMethod) {
            filtered = filtered.filter(r => {
                const data = r.extracted_data?.payment_methods;
                if (!data) return false;
                const method = selectedPaymentMethod.toLowerCase();
                return data[method] && data[method] > 0;
            });
        }
        
        return filtered;
    }, [reports, timeRange, selectedPaymentMethod]);

    const filteredSalesData = useMemo(() => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - parseInt(timeRange));
        let filtered = salesData.filter(d => new Date(d.date) >= cutoffDate);
        
        // Filter by category if selected
        if (selectedCategory !== 'all' && selectedCategory) {
            filtered = filtered.filter(d => d.category === selectedCategory);
        }
        
        return filtered;
    }, [salesData, timeRange, selectedCategory]);

    // Calculate KPIs
    const kpis = useMemo(() => {
        const totalRevenue = filteredReports.reduce((sum, r) => sum + (r.total_revenue || 0), 0);
        const totalTransactions = filteredReports.reduce((sum, r) => sum + (r.total_transactions || 0), 0);
        const avgTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

        return {
            totalRevenue,
            totalTransactions,
            avgTransaction,
            reportCount: filteredReports.length
        };
    }, [filteredReports]);

    // Top sellers
    const topSellers = useMemo(() => {
        const itemSales = {};
        filteredSalesData.forEach(item => {
            if (item.item_name) {
                if (!itemSales[item.item_name]) {
                    itemSales[item.item_name] = { quantity: 0, revenue: 0 };
                }
                itemSales[item.item_name].quantity += item.quantity_sold || 0;
                itemSales[item.item_name].revenue += item.revenue || 0;
            }
        });

        return Object.entries(itemSales)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);
    }, [filteredSalesData]);

    // Revenue trend - dynamisch basierend auf Zeitraum
    const revenueTrend = useMemo(() => {
        const range = parseInt(timeRange);
        const dailyRevenue = {};
        
        // Bestimme Gruppierung basierend auf Zeitraum
        const shouldGroupByWeek = range > 60;
        const shouldGroupByMonth = range > 180;
        
        filteredReports.forEach(report => {
            let dateKey;
            const reportDate = new Date(report.report_date);
            
            if (shouldGroupByMonth) {
                // Gruppiere nach Monat
                dateKey = reportDate.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
            } else if (shouldGroupByWeek) {
                // Gruppiere nach Woche
                const weekStart = new Date(reportDate);
                weekStart.setDate(reportDate.getDate() - reportDate.getDay() + 1); // Montag
                dateKey = weekStart.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
            } else {
                // Tägliche Ansicht
                dateKey = reportDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
            }
            
            dailyRevenue[dateKey] = (dailyRevenue[dateKey] || 0) + (report.total_revenue || 0);
        });

        return Object.entries(dailyRevenue)
            .map(([date, revenue]) => ({ date, revenue }))
            .sort((a, b) => {
                // Sortiere chronologisch
                const parseDate = (str) => {
                    const parts = str.split('.');
                    if (parts.length === 2) {
                        return new Date(2000 + parseInt(parts[1]), parseInt(parts[0]) - 1);
                    }
                    return new Date(str);
                };
                return parseDate(a.date) - parseDate(b.date);
            });
    }, [filteredReports, timeRange]);

    // Category breakdown
    const categoryBreakdown = useMemo(() => {
        const categoryData = {};
        filteredSalesData.forEach(item => {
            if (item.category) {
                categoryData[item.category] = (categoryData[item.category] || 0) + (item.revenue || 0);
            }
        });

        return Object.entries(categoryData)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [filteredSalesData]);

    // Payment methods breakdown
    const paymentMethodsData = useMemo(() => {
        const methods = { Bar: 0, Karte: 0, Gutschein: 0, Sonstiges: 0 };
        filteredReports.forEach(report => {
            const pm = report.extracted_data?.payment_methods;
            if (pm) {
                methods.Bar += pm.cash || 0;
                methods.Karte += pm.card || 0;
                methods.Gutschein += pm.voucher || 0;
                methods.Sonstiges += pm.other || 0;
            }
        });
        return Object.entries(methods)
            .map(([name, value]) => ({ name, value }))
            .filter(m => m.value > 0);
    }, [filteredReports]);

    // Hourly heatmap data
    const hourlyHeatmap = useMemo(() => {
        const heatmapData = {};
        const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
        
        filteredSalesData.forEach(item => {
            if (item.hour !== undefined && item.day_of_week) {
                const key = `${item.day_of_week}-${item.hour}`;
                heatmapData[key] = (heatmapData[key] || 0) + (item.revenue || 0);
            }
        });

        const result = [];
        for (let hour = 18; hour <= 23; hour++) {
            days.forEach((day, dayIndex) => {
                const key = `${day}-${hour}`;
                result.push({
                    hour: `${hour}:00`,
                    day,
                    dayIndex,
                    revenue: heatmapData[key] || 0
                });
            });
        }
        return result;
    }, [filteredSalesData]);

    // Price vs Quantity scatter plot
    const scatterData = useMemo(() => {
        return filteredSalesData
            .filter(item => item.price && item.quantity_sold)
            .map(item => ({
                x: item.price,
                y: item.quantity_sold,
                z: item.revenue || 0,
                name: item.item_name
            }));
    }, [filteredSalesData]);

    // Get unique categories and payment methods
    const categories = useMemo(() => {
        const cats = new Set();
        salesData.forEach(item => item.category && cats.add(item.category));
        return Array.from(cats);
    }, [salesData]);

    const activeFiltersCount = [selectedCategory !== 'all', selectedPaymentMethod !== 'all'].filter(Boolean).length;

    return (
        <div className="space-y-6">
            {/* Header with Time Range Selector */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h2 className="text-2xl font-bold text-foreground">Verkaufs-Analyse</h2>
                <div className="flex gap-3">
                    <Select value={timeRange} onValueChange={setTimeRange}>
                        <SelectTrigger className="w-40 bg-card border-border text-foreground">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7">Letzte 7 Tage</SelectItem>
                            <SelectItem value="30">Letzte 30 Tage</SelectItem>
                            <SelectItem value="90">Letzte 90 Tage</SelectItem>
                            <SelectItem value="365">Letztes Jahr</SelectItem>
                            <SelectItem value="3650">Alle Daten</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Filters */}
            <Card className="bg-card/50 border-border">
                <CardHeader className="pb-3">
                    <CardTitle className="text-foreground text-sm flex items-center gap-2">
                        <Filter className="w-4 h-4" />
                        Filter
                        {activeFiltersCount > 0 && (
                            <Badge variant="secondary" className="ml-2">
                                {activeFiltersCount}
                            </Badge>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Kategorie</label>
                            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                <SelectTrigger className="bg-background border-border/70 text-foreground">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Alle Kategorien</SelectItem>
                                    {categories.map(cat => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Zahlungsart</label>
                            <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
                                <SelectTrigger className="bg-background border-border/70 text-foreground">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Alle Zahlungsarten</SelectItem>
                                    <SelectItem value="cash">Bar</SelectItem>
                                    <SelectItem value="card">Karte</SelectItem>
                                    <SelectItem value="voucher">Gutschein</SelectItem>
                                    <SelectItem value="other">Sonstiges</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {activeFiltersCount > 0 && (
                            <div className="flex items-end">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setSelectedCategory('all');
                                        setSelectedPaymentMethod('all');
                                    }}
                                    className="w-full border-border/70 text-foreground/75 hover:bg-secondary"
                                >
                                    <X className="w-4 h-4 mr-2" />
                                    Filter zurücksetzen
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-amber-900/20 to-orange-900/20 border-amber-800/30">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-amber-400">Gesamtumsatz</CardTitle>
                        <DollarSign className="w-4 h-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">{kpis.totalRevenue.toFixed(2)} €</div>
                        <p className="text-xs text-muted-foreground mt-1">{kpis.reportCount} Berichte</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-900/20 to-indigo-900/20 border-blue-800/30">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-blue-400">Transaktionen</CardTitle>
                        <ShoppingCart className="w-4 h-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">{kpis.totalTransactions}</div>
                        <p className="text-xs text-muted-foreground mt-1">Verkäufe</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border-green-800/30">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-green-400">Ø Bonwert</CardTitle>
                        <TrendingUp className="w-4 h-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">{kpis.avgTransaction.toFixed(2)} €</div>
                        <p className="text-xs text-muted-foreground mt-1">pro Transaktion</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border-purple-800/30">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-purple-400">Top Artikel</CardTitle>
                        <Award className="w-4 h-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">{topSellers.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">verschiedene Produkte</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts */}
            <Tabs defaultValue="trend" className="space-y-4">
                <TabsList className="bg-card border border-border flex-wrap h-auto">
                    <TabsTrigger value="trend" className="data-[state=active]:bg-amber-600">Umsatztrend</TabsTrigger>
                    <TabsTrigger value="topsellers" className="data-[state=active]:bg-amber-600">Top-Seller</TabsTrigger>
                    <TabsTrigger value="categories" className="data-[state=active]:bg-amber-600">Kategorien</TabsTrigger>
                    <TabsTrigger value="payment" className="data-[state=active]:bg-amber-600">Zahlungsarten</TabsTrigger>
                    <TabsTrigger value="heatmap" className="data-[state=active]:bg-amber-600">Zeitanalyse</TabsTrigger>
                    <TabsTrigger value="scatter" className="data-[state=active]:bg-amber-600">Preis-Menge</TabsTrigger>
                </TabsList>

                <TabsContent value="trend">
                    <Card className="bg-card/50 border-border">
                        <CardHeader>
                            <CardTitle className="text-foreground flex items-center justify-between">
                                <span>Umsatzentwicklung</span>
                                <span className="text-sm font-normal text-muted-foreground">
                                    {parseInt(timeRange) > 180 ? 'Monatlich' : parseInt(timeRange) > 60 ? 'Wöchentlich' : 'Täglich'}
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={revenueTrend}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                    <XAxis 
                                        dataKey="date" 
                                        stroke="#9ca3af"
                                        angle={revenueTrend.length > 20 ? -45 : 0}
                                        textAnchor={revenueTrend.length > 20 ? "end" : "middle"}
                                        height={revenueTrend.length > 20 ? 80 : 30}
                                    />
                                    <YAxis stroke="#9ca3af" />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                                        labelStyle={{ color: '#f1f5f9' }}
                                        formatter={(value) => [`${value.toFixed(2)} €`, 'Umsatz']}
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="revenue" 
                                        stroke="#f59e0b" 
                                        strokeWidth={2} 
                                        dot={revenueTrend.length <= 30}
                                        activeDot={{ r: 6 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="topsellers">
                    <Card className="bg-card/50 border-border">
                        <CardHeader>
                            <CardTitle className="text-foreground flex items-center justify-between">
                                <span>Top 10 Verkaufsschlager</span>
                                {drilldownItem && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setDrilldownItem(null)}
                                        className="text-amber-500"
                                    >
                                        <X className="w-4 h-4 mr-2" />
                                        Zurück zur Übersicht
                                    </Button>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {drilldownItem ? (
                                <div className="space-y-4">
                                    <div className="bg-background rounded-lg p-4">
                                        <h3 className="text-lg font-semibold text-foreground mb-2">{drilldownItem.name}</h3>
                                        <div className="grid grid-cols-3 gap-4 text-sm">
                                            <div>
                                                <p className="text-muted-foreground">Gesamtumsatz</p>
                                                <p className="text-xl font-bold text-amber-500">{drilldownItem.revenue.toFixed(2)} €</p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground">Verkaufte Menge</p>
                                                <p className="text-xl font-bold text-foreground">{drilldownItem.quantity}</p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground">Ø Preis</p>
                                                <p className="text-xl font-bold text-foreground">
                                                    {(drilldownItem.revenue / drilldownItem.quantity).toFixed(2)} €
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height={400}>
                                    <BarChart data={topSellers} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                        <XAxis type="number" stroke="#9ca3af" />
                                        <YAxis dataKey="name" type="category" width={150} stroke="#9ca3af" />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                                            labelStyle={{ color: '#f1f5f9' }}
                                        />
                                        <Bar 
                                            dataKey="revenue" 
                                            fill="#f59e0b"
                                            onClick={(data) => setDrilldownItem(data)}
                                            cursor="pointer"
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="categories">
                    <Card className="bg-card/50 border-border">
                        <CardHeader>
                            <CardTitle className="text-foreground">Umsatz nach Kategorie</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={categoryBreakdown}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={(entry) => `${entry.name}: ${entry.value.toFixed(0)}€`}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {categoryBreakdown.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="payment">
                    <Card className="bg-card/50 border-border">
                        <CardHeader>
                            <CardTitle className="text-foreground">Zahlungsarten-Verteilung</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={paymentMethodsData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                    <XAxis dataKey="name" stroke="#9ca3af" />
                                    <YAxis stroke="#9ca3af" />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                                        formatter={(value) => [`${value.toFixed(2)} €`, 'Umsatz']}
                                    />
                                    <Bar dataKey="value" fill="#10b981" />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="heatmap">
                    <Card className="bg-card/50 border-border">
                        <CardHeader>
                            <CardTitle className="text-foreground">Umsatz nach Wochentag & Uhrzeit</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">Hellere Farben = höherer Umsatz</p>
                        </CardHeader>
                        <CardContent>
                            {hourlyHeatmap.length > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <ScatterChart>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                        <XAxis 
                                            type="category" 
                                            dataKey="day" 
                                            name="Tag"
                                            stroke="#9ca3af"
                                        />
                                        <YAxis 
                                            type="category" 
                                            dataKey="hour" 
                                            name="Uhrzeit"
                                            stroke="#9ca3af"
                                        />
                                        <ZAxis 
                                            type="number" 
                                            dataKey="revenue" 
                                            range={[50, 500]} 
                                            name="Umsatz"
                                        />
                                        <Tooltip 
                                            cursor={{ strokeDasharray: '3 3' }}
                                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                                            formatter={(value) => [`${value.toFixed(2)} €`, 'Umsatz']}
                                        />
                                        <Scatter data={hourlyHeatmap} fill="#f59e0b" />
                                    </ScatterChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="text-center py-12 text-muted-foreground">
                                    Keine Stundendaten verfügbar
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="scatter">
                    <Card className="bg-card/50 border-border">
                        <CardHeader>
                            <CardTitle className="text-foreground">Preis vs. Verkaufsmenge</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">Größere Punkte = höherer Umsatz</p>
                        </CardHeader>
                        <CardContent>
                            {scatterData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={400}>
                                    <ScatterChart>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                        <XAxis 
                                            type="number" 
                                            dataKey="x" 
                                            name="Preis"
                                            unit="€"
                                            stroke="#9ca3af"
                                        />
                                        <YAxis 
                                            type="number" 
                                            dataKey="y" 
                                            name="Menge"
                                            stroke="#9ca3af"
                                        />
                                        <ZAxis 
                                            type="number" 
                                            dataKey="z" 
                                            range={[50, 400]} 
                                            name="Umsatz"
                                        />
                                        <Tooltip 
                                            cursor={{ strokeDasharray: '3 3' }}
                                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                                            formatter={(value, name) => {
                                                if (name === 'Preis') return [`${value.toFixed(2)} €`, name];
                                                if (name === 'Umsatz') return [`${value.toFixed(2)} €`, name];
                                                return [value, name];
                                            }}
                                        />
                                        <Scatter data={scatterData} fill="#8b5cf6" />
                                    </ScatterChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="text-center py-12 text-muted-foreground">
                                    Keine Preisdaten verfügbar
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}