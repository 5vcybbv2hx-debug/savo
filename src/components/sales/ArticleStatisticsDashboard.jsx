import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

const COLORS = ['#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#ef4444', '#f97316', '#6366f1'];

export default function ArticleStatisticsDashboard({ articles = [] }) {
  const [expandedCategory, setExpandedCategory] = useState(null);

  // Gruppiere Artikel nach Warengruppe (Main) und Untergruppe
  const groupedData = useMemo(() => {
    const groups = {};
    
    articles.forEach(article => {
      const mainGroup = article.main_category || 'Sonstiges';
      const subGroup = article.sub_category || 'Allgemein';
      
      if (!groups[mainGroup]) {
        groups[mainGroup] = {
          name: mainGroup,
          items: {},
          totalRevenue: 0,
          totalQuantity: 0,
          totalPercentage: 0
        };
      }
      
      if (!groups[mainGroup].items[subGroup]) {
        groups[mainGroup].items[subGroup] = {
          name: subGroup,
          articles: [],
          totalRevenue: 0,
          totalQuantity: 0,
          percentage: 0
        };
      }
      
      groups[mainGroup].items[subGroup].articles.push(article);
      groups[mainGroup].items[subGroup].totalRevenue += article.revenue || 0;
      groups[mainGroup].items[subGroup].totalQuantity += article.quantity || 0;
    });
    
    // Berechne Prozente
    const totalRevenue = articles.reduce((sum, a) => sum + (a.revenue || 0), 0);
    
    Object.keys(groups).forEach(mainGroup => {
      groups[mainGroup].totalRevenue = Object.values(groups[mainGroup].items).reduce((sum, item) => sum + item.totalRevenue, 0);
      groups[mainGroup].totalQuantity = Object.values(groups[mainGroup].items).reduce((sum, item) => sum + item.totalQuantity, 0);
      groups[mainGroup].totalPercentage = totalRevenue > 0 ? (groups[mainGroup].totalRevenue / totalRevenue * 100).toFixed(2) : 0;
      
      Object.keys(groups[mainGroup].items).forEach(subGroup => {
        groups[mainGroup].items[subGroup].percentage = totalRevenue > 0 
          ? (groups[mainGroup].items[subGroup].totalRevenue / totalRevenue * 100).toFixed(2) 
          : 0;
      });
    });
    
    return groups;
  }, [articles]);

  // Top Artikel (nach Umsatz)
  const topArticles = useMemo(() => {
    return articles
      .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
      .slice(0, 10)
      .map(a => ({
        name: a.name,
        revenue: a.revenue || 0,
        quantity: a.quantity || 0
      }));
  }, [articles]);

  // Warengruppen für Pie-Chart
  const categoryChartData = useMemo(() => {
    return Object.values(groupedData)
      .map(cat => ({
        name: cat.name,
        value: parseFloat(cat.totalRevenue.toFixed(2))
      }))
      .sort((a, b) => b.value - a.value);
  }, [groupedData]);

  const totalRevenue = articles.reduce((sum, a) => sum + (a.revenue || 0), 0);
  const totalQuantity = articles.reduce((sum, a) => sum + (a.quantity || 0), 0);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card/50 border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Gesamtumsatz</p>
                <p className="text-3xl font-bold text-foreground mt-1">{totalRevenue.toFixed(2)} €</p>
              </div>
              <TrendingUp className="w-10 h-10 text-status-warn opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Gesamtmenge</p>
                <p className="text-3xl font-bold text-foreground mt-1">{totalQuantity}</p>
              </div>
              <Package className="w-10 h-10 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border">
          <CardContent className="pt-6">
            <div>
              <p className="text-muted-foreground text-sm">Durchschnitt pro Artikel</p>
              <p className="text-3xl font-bold text-foreground mt-1">{totalQuantity > 0 ? (totalRevenue / totalQuantity).toFixed(2) : 0} €</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 Artikel */}
        <Card className="bg-card/50 border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Top 10 Artikel nach Umsatz</CardTitle>
          </CardHeader>
          <CardContent>
            {topArticles.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topArticles}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  <Bar dataKey="revenue" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-8">Keine Daten</p>
            )}
          </CardContent>
        </Card>

        {/* Warengruppen Pie Chart */}
        <Card className="bg-card/50 border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Umsatz nach Warengruppe</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value.toFixed(2)} €`} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-8">Keine Daten</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detaillierte Warengruppen */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Warengruppen Übersicht</h2>
        {Object.values(groupedData).map(mainGroup => (
          <Card key={mainGroup.name} className="bg-card/50 border-border">
            <div
              onClick={() => setExpandedCategory(expandedCategory === mainGroup.name ? null : mainGroup.name)}
              className="px-6 py-4 cursor-pointer hover:bg-secondary/30 transition-colors flex items-center justify-between"
            >
              <div className="flex-1">
                <h3 className="text-lg font-bold text-foreground">{mainGroup.name}</h3>
                <div className="flex gap-4 mt-2 text-sm">
                  <span className="text-muted-foreground">
                    Umsatz: <span className="text-status-warn font-semibold">{mainGroup.totalRevenue.toFixed(2)} €</span>
                  </span>
                  <span className="text-muted-foreground">
                    Menge: <span className="text-primary font-semibold">{mainGroup.totalQuantity}</span>
                  </span>
                  <span className="text-muted-foreground">
                    Anteil: <span className="text-status-ok font-semibold">{mainGroup.totalPercentage}%</span>
                  </span>
                </div>
              </div>
              <div className="text-right">
                <Badge className="bg-status-warn/80 text-foreground">
                  {Object.keys(mainGroup.items).length} Gruppen
                </Badge>
              </div>
            </div>

            {expandedCategory === mainGroup.name && (
              <div className="border-t border-border divide-y border-border">
                {Object.values(mainGroup.items).map(subGroup => (
                  <div key={subGroup.name} className="px-6 py-4 bg-background/40">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-foreground">{subGroup.name}</h4>
                      <div className="flex gap-3 text-sm">
                        <Badge variant="outline" className="text-foreground/75 border-border/70">
                          {subGroup.percentage}%
                        </Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {subGroup.articles.map(article => (
                        <div key={article.id} className="bg-background rounded p-3 border border-border/50">
                          <p className="text-foreground font-medium text-sm truncate">{article.name}</p>
                          <div className="flex justify-between mt-2 text-xs">
                            <span className="text-muted-foreground">
                              Umsatz: <span className="text-status-warn">{article.revenue?.toFixed(2) || 0} €</span>
                            </span>
                            <span className="text-muted-foreground">
                              Menge: <span className="text-primary">{article.quantity || 0}</span>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}