import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Calculator, AlertTriangle } from 'lucide-react';

// Hilfsfunktion zum Parsen der Größenangabe
const parseServingSize = (sizeString) => {
    if (!sizeString) return 0;
    
    const size = sizeString.toLowerCase().replace(',', '.');
    
    // Liter: 0,3l, 0.5l
    if (size.includes('l')) {
        return parseFloat(size.replace('l', '').trim()) || 0;
    }
    
    // Centiliter: 4cl, 2cl
    if (size.includes('cl')) {
        return (parseFloat(size.replace('cl', '').trim()) || 0) / 100;
    }
    
    // Milliliter: 330ml, 500ml
    if (size.includes('ml')) {
        return (parseFloat(size.replace('ml', '').trim()) || 0) / 1000;
    }
    
    return 0;
};

export default function MarginCalculator({ menuItem }) {
    const [calculatedData, setCalculatedData] = useState(null);

    const { data: recipe } = useQuery({
        queryKey: ['recipe', menuItem?.linked_recipe_id],
        queryFn: () => base44.entities.Recipe.filter({ id: menuItem.linked_recipe_id }),
        enabled: !!menuItem?.linked_recipe_id && menuItem?.use_recipe_calculation,
        select: (data) => data[0]
    });

    const { data: articles = [] } = useQuery({
        queryKey: ['articles-for-margin'],
        queryFn: () => base44.entities.Article.list(),
        placeholderData: []
    });

    useEffect(() => {
        if (!menuItem) return;

        let purchasePrice = 0;
        let calculationMethod = 'none';

        // Berechnung aus Rezept
        if (menuItem.use_recipe_calculation && recipe?.ingredients) {
            let totalCost = 0;
            console.log('🔍 Rezeptberechnung:', {
                recipeName: recipe.name,
                ingredientsCount: recipe.ingredients.length
            });
            
            recipe.ingredients.forEach(ingredient => {
                const article = articles.find(a => a.id === ingredient.article_id);
                console.log('📦 Zutat:', {
                    name: ingredient.article_name,
                    amount: ingredient.amount,
                    unit: ingredient.unit,
                    article_found: !!article,
                    price_per_liter: article?.price_per_liter,
                    purchase_price: article?.purchase_price
                });
                
                if (article && ingredient.amount) {
                    const unit = ingredient.unit || 'ml';
                    let cost = 0;
                    
                    // Wenn price_per_liter vorhanden ist, nutze das
                    if (article.price_per_liter) {
                        let amountInLiters = 0;
                        switch (unit.toLowerCase()) {
                            case 'ml':
                                amountInLiters = ingredient.amount / 1000;
                                break;
                            case 'cl':
                                amountInLiters = ingredient.amount / 100;
                                break;
                            case 'l':
                                amountInLiters = ingredient.amount;
                                break;
                            case 'g':
                                amountInLiters = ingredient.amount / 1000;
                                break;
                            case 'kg':
                                amountInLiters = ingredient.amount;
                                break;
                            case 'stk':
                            case 'stück':
                                cost = article.purchase_price ? article.purchase_price * ingredient.amount : 0;
                                break;
                        }
                        if (amountInLiters > 0) {
                            cost = amountInLiters * article.price_per_liter;
                        }
                    }
                    // Fallback: Berechne price_per_liter aus purchase_price und content
                    else if (article.purchase_price && article.content_amount) {
                        let contentInLiters = article.content_amount;
                        const contentUnit = article.content_unit || 'ml';
                        
                        // Umrechnung Inhalt in Liter
                        if (contentUnit === 'ml') contentInLiters = article.content_amount / 1000;
                        else if (contentUnit === 'g') contentInLiters = article.content_amount / 1000;
                        else if (contentUnit === 'l' || contentUnit === 'kg') contentInLiters = article.content_amount;
                        
                        const calculatedPricePerLiter = article.purchase_price / contentInLiters;
                        
                        let amountInLiters = 0;
                        switch (unit.toLowerCase()) {
                            case 'ml':
                                amountInLiters = ingredient.amount / 1000;
                                break;
                            case 'cl':
                                amountInLiters = ingredient.amount / 100;
                                break;
                            case 'l':
                                amountInLiters = ingredient.amount;
                                break;
                            case 'g':
                                amountInLiters = ingredient.amount / 1000;
                                break;
                            case 'kg':
                                amountInLiters = ingredient.amount;
                                break;
                            case 'stk':
                            case 'stück':
                                cost = article.purchase_price * ingredient.amount;
                                break;
                        }
                        if (amountInLiters > 0) {
                            cost = amountInLiters * calculatedPricePerLiter;
                        }
                    }
                    
                    console.log('💰 Kosten:', cost);
                    totalCost += cost;
                }
            });
            
            console.log('✅ Gesamtkosten:', totalCost);
            purchasePrice = totalCost;
            calculationMethod = 'recipe';
        }
        // Berechnung aus verknüpftem Artikel
        else if (menuItem.linked_article_id) {
            const linkedArticle = articles.find(a => a.id === menuItem.linked_article_id);
            console.log('🔗 Verknüpfter Artikel:', {
                article: linkedArticle?.name,
                purchase_price: linkedArticle?.purchase_price,
                content_amount: linkedArticle?.content_amount,
                content_unit: linkedArticle?.content_unit,
                price_per_liter: linkedArticle?.price_per_liter,
                menuItemSize: menuItem.size
            });
            
            if (linkedArticle) {
                const servingSize = parseServingSize(menuItem.size);
                console.log('📏 Serving Size (in Litern):', servingSize);
                
                // Verwende price_per_liter wenn vorhanden
                if (linkedArticle.price_per_liter && servingSize > 0) {
                    purchasePrice = linkedArticle.price_per_liter * servingSize;
                    console.log('💰 Berechnung über price_per_liter:', purchasePrice);
                }
                // Sonst berechne aus purchase_price und content_amount
                else if (linkedArticle.purchase_price && linkedArticle.content_amount && servingSize > 0) {
                    let contentInLiters = linkedArticle.content_amount;
                    const contentUnit = (linkedArticle.content_unit || 'ml').toLowerCase();
                    
                    // Umrechnung in Liter
                    if (contentUnit === 'ml') contentInLiters = linkedArticle.content_amount / 1000;
                    else if (contentUnit === 'cl') contentInLiters = linkedArticle.content_amount / 100;
                    else if (contentUnit === 'g') contentInLiters = linkedArticle.content_amount / 1000;
                    else if (contentUnit === 'l' || contentUnit === 'kg') contentInLiters = linkedArticle.content_amount;
                    
                    const pricePerLiter = linkedArticle.purchase_price / contentInLiters;
                    purchasePrice = pricePerLiter * servingSize;
                    console.log('💰 Berechnung:', {
                        contentInLiters,
                        pricePerLiter,
                        servingSize,
                        purchasePrice
                    });
                }
                // Fallback: direkter Preis
                else if (linkedArticle.purchase_price) {
                    purchasePrice = linkedArticle.purchase_price;
                    console.log('💰 Fallback: direkter Preis');
                }
                
                if (purchasePrice > 0) {
                    calculationMethod = 'article';
                }
            }
        }
        // Manueller EK
        else if (menuItem.purchase_price) {
            purchasePrice = menuItem.purchase_price;
            calculationMethod = 'manual';
        }

        // Margen berechnen
        const marginAbsolute = menuItem.price - purchasePrice;
        const marginPercentage = purchasePrice > 0 
            ? ((marginAbsolute / purchasePrice) * 100)
            : 0;

        // Empfohlener VK (70% Marge = Faktor 3.33)
        const recommendedPrice = purchasePrice > 0 ? purchasePrice * 3.33 : 0;

        setCalculatedData({
            purchasePrice,
            marginAbsolute,
            marginPercentage,
            calculationMethod,
            recommendedPrice,
            hasData: purchasePrice > 0
        });
    }, [menuItem, recipe, articles]);

    if (!calculatedData?.hasData) {
        return (
            <Card className="border-slate-600 bg-slate-800/30">
                <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                        <AlertTriangle className="w-4 h-4" />
                        Keine Margenberechnung möglich - EK fehlt
                    </div>
                </CardContent>
            </Card>
        );
    }

    const isGoodMargin = calculatedData.marginPercentage >= 300;
    const isOkMargin = calculatedData.marginPercentage >= 200;

    return (
        <Card className="border-slate-600 bg-gradient-to-br from-slate-800/50 to-slate-800/30">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Calculator className="w-4 h-4" />
                    Margenanalyse
                    <Badge variant="outline" className="ml-auto text-xs">
                        {calculatedData.calculationMethod === 'recipe' ? 'Rezept' : 
                         calculatedData.calculationMethod === 'article' ? 'Artikel' : 
                         'Manuell'}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="grid grid-cols-4 gap-2">
                    <div>
                        <p className="text-xs text-slate-400 mb-1">VK</p>
                        <p className="text-base font-bold text-white">
                            {menuItem.price?.toFixed(2)} €
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 mb-1">EK</p>
                        <p className="text-base font-bold text-slate-300">
                            {calculatedData.purchasePrice.toFixed(2)} €
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 mb-1">Empf.</p>
                        <p className="text-base font-bold text-blue-400">
                            {calculatedData.recommendedPrice.toFixed(2)} €
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 mb-1">Gewinn</p>
                        <p className="text-base font-bold text-green-400">
                            {calculatedData.marginAbsolute.toFixed(2)} €
                        </p>
                    </div>
                </div>

                <div className="pt-2 border-t border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Aufschlag</span>
                        <div className="flex items-center gap-2">
                            {isGoodMargin ? (
                                <TrendingUp className="w-4 h-4 text-green-500" />
                            ) : !isOkMargin ? (
                                <TrendingDown className="w-4 h-4 text-red-500" />
                            ) : (
                                <TrendingUp className="w-4 h-4 text-yellow-500" />
                            )}
                            <span className={`text-xl font-bold ${
                                isGoodMargin ? 'text-green-400' : 
                                isOkMargin ? 'text-yellow-400' : 
                                'text-red-400'
                            }`}>
                                {calculatedData.marginPercentage.toFixed(0)}%
                            </span>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500">
                        {isGoodMargin ? '✓ Sehr gut' : 
                         isOkMargin ? '⚠ OK' : 
                         '⚠ Zu niedrig'}
                    </p>
                    
                    {Math.abs(menuItem.price - calculatedData.recommendedPrice) > 0.5 && (
                        <div className={`p-2 rounded-lg text-xs ${
                            menuItem.price < calculatedData.recommendedPrice
                                ? 'bg-blue-900/30 border border-blue-800/50 text-blue-300'
                                : 'bg-green-900/30 border border-green-800/50 text-green-300'
                        }`}>
                            {menuItem.price < calculatedData.recommendedPrice 
                                ? `💡 Potenzial: +${(calculatedData.recommendedPrice - menuItem.price).toFixed(2)} €`
                                : `✓ Über Empfehlung (+${(menuItem.price - calculatedData.recommendedPrice).toFixed(2)} €)`
                            }
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}