import GoogleLoginButton from "./GoogleLoginButton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Next.js 15+에서 searchParams는 Promise입니다
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            식수 예측 시스템
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Google 계정으로 로그인하세요
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 에러 메시지 표시 */}
          {error && (
            <div className="rounded-md bg-red-50 p-3">
              <p className="text-red-600 text-sm text-center">
                로그인 실패: {decodeURIComponent(error)}
              </p>
            </div>
          )}

          {/* Google 로그인 버튼 (재사용 가능한 Client Component) */}
          <GoogleLoginButton />
        </CardContent>
      </Card>
    </div>
  );
}

