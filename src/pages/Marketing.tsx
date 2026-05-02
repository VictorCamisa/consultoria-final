import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Image as ImageIcon, Palette } from "lucide-react";
import { CreatePostTab } from "@/components/marketing/CreatePostTab";
import { PostsGalleryTab } from "@/components/marketing/PostsGalleryTab";
import { BrandAssetsPanel } from "@/components/marketing/BrandAssetsPanel";

export default function Marketing() {
  return (
    <div className="px-4 py-5 sm:p-6 space-y-5 sm:space-y-6">
      <div className="hidden sm:block">
        <h1 className="vs-h1">Marketing</h1>
        <p className="text-sm text-muted-foreground">
          Geração de posts com IA, galeria de conteúdo e ativos de marca da VS.
        </p>
      </div>

      <Tabs defaultValue="create" className="w-full">
        <TabsList>
          <TabsTrigger value="create" className="gap-2">
            <Sparkles className="h-4 w-4" /> Criar Post
          </TabsTrigger>
          <TabsTrigger value="gallery" className="gap-2">
            <ImageIcon className="h-4 w-4" /> Galeria
          </TabsTrigger>
          <TabsTrigger value="brand" className="gap-2">
            <Palette className="h-4 w-4" /> Brand Assets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="mt-4">
          <CreatePostTab />
        </TabsContent>
        <TabsContent value="gallery" className="mt-4">
          <PostsGalleryTab />
        </TabsContent>
        <TabsContent value="brand" className="mt-4">
          <BrandAssetsPanel onClose={() => {}} />
        </TabsContent>
      </Tabs>
    </div>
  );
}