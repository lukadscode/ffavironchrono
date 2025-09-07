import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Category {
  id: string;
  label: string;
  crew_count: number;
}

export default function CategoriesList({ categories }: { categories: Category[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Catégories disponibles</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {categories.map((cat) => (
            <li key={cat.id} className="flex justify-between border-b pb-2">
              <span>{cat.label}</span>
              <span className="text-muted-foreground">{cat.crew_count} équipages</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
