import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
        <h2 className="text-2xl font-semibold">Страница не найдена</h2>
        <p className="text-muted-foreground max-w-md">
          Запрошенная страница не существует или была перемещена.
        </p>
        <Button asChild>
          <Link href="/dashboard">Вернуться на дашборд</Link>
        </Button>
      </div>
    </div>
  );
}
