import { PermanentError } from '../errors';
import { expiresIn, request } from '../http';
import {
  defaultContext,
  emptyMetrics,
  type AuthUrlParams,
  type ConnectedAccount,
  type ConnectorContext,
  type OAuthClientConfig,
  type PlatformConnector,
  type PostMetrics,
  type PublishRequest,
  type PublishResult,
  type TokenSet,
} from '../types';

const OAUTH_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const OAUTH_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const OAUTH_REVOKE_URL = 'https://www.linkedin.com/oauth/v2/revoke';
const API_V2 = 'https://api.linkedin.com/v2';

/**
 * LinkedIn API connector.
 * Uses OAuth 2.0 with OpenID Connect for user profile discovery and
 * LinkedIn UGC Posts API for publishing text, images, and videos.
 */
export class LinkedInConnector implements PlatformConnector {
  readonly platform = 'linkedin' as const;
  readonly scopes: string[];
  readonly usesPkce = false;

  constructor(
    private readonly client: OAuthClientConfig,
    private readonly ctx: ConnectorContext = defaultContext,
  ) {
    const envScopes = process.env.LINKEDIN_SCOPES?.trim();
    this.scopes = envScopes
      ? envScopes.split(/[\s,]+/).filter(Boolean)
      : ['openid', 'profile', 'email', 'w_member_social'];
  }

  getAuthUrl({ state, redirectUri }: AuthUrlParams): string {
    const u = new URL(OAUTH_AUTH_URL);
    u.search = new URLSearchParams({
      response_type: 'code',
      client_id: this.client.clientId,
      redirect_uri: redirectUri,
      state,
      scope: this.scopes.join(' '),
    }).toString();
    return u.toString();
  }

  private toTokenSet(res: any): TokenSet {
    return {
      accessToken: res.access_token,
      refreshToken: res.refresh_token ?? null,
      expiresAt: expiresIn(this.ctx, res.expires_in),
      refreshExpiresAt: expiresIn(this.ctx, res.refresh_token_expires_in),
      scopes:
        typeof res.scope === 'string'
          ? res.scope.split(/[\s,]+/).filter(Boolean)
          : this.scopes,
    };
  }

  async exchangeCode(code: string, redirectUri: string): Promise<TokenSet> {
    const res = await request(this.ctx, OAUTH_TOKEN_URL, {
      form: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: this.client.clientId,
        client_secret: this.client.clientSecret,
      },
    });
    return this.toTokenSet(res);
  }

  async refresh(refreshToken: string): Promise<TokenSet> {
    const res = await request(this.ctx, OAUTH_TOKEN_URL, {
      form: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.client.clientId,
        client_secret: this.client.clientSecret,
      },
    });
    return this.toTokenSet(res);
  }

  async listAccounts(token: TokenSet): Promise<ConnectedAccount[]> {
    const accounts: ConnectedAccount[] = [];

    // 1. Fetch authenticated user profile using OpenID Connect userinfo
    try {
      const user = await request(this.ctx, `${API_V2}/userinfo`, {
        bearer: token.accessToken,
      });

      if (user && user.sub) {
        const urn = user.sub.startsWith('urn:li:') ? user.sub : `urn:li:person:${user.sub}`;
        accounts.push({
          externalId: urn,
          displayName:
            user.name ||
            `${user.given_name ?? ''} ${user.family_name ?? ''}`.trim() ||
            'LinkedIn Member',
          username: user.email ? user.email.split('@')[0] : null,
          avatarUrl: user.picture ?? null,
          metadata: {
            personUrn: urn,
            sub: user.sub,
            email: user.email ?? null,
            type: 'person',
          },
        });
      }
    } catch {
      // Fallback to legacy v2/me endpoint if userinfo is unavailable
      try {
        const me = await request(this.ctx, `${API_V2}/me`, {
          bearer: token.accessToken,
        });
        if (me && me.id) {
          const urn = `urn:li:person:${me.id}`;
          const displayName =
            `${me.localizedFirstName ?? ''} ${me.localizedLastName ?? ''}`.trim() ||
            'LinkedIn Member';
          accounts.push({
            externalId: urn,
            displayName,
            username: me.id,
            avatarUrl: null,
            metadata: {
              personUrn: urn,
              id: me.id,
              type: 'person',
            },
          });
        }
      } catch {
        // Continue if profile lookup failed
      }
    }

    // 2. Fetch organizational pages if permission is available
    try {
      const orgAcls = await request(this.ctx, `${API_V2}/organizationalEntityAcls`, {
        bearer: token.accessToken,
        query: {
          q: 'roleAssignee',
          state: 'APPROVED',
        },
      });

      if (Array.isArray(orgAcls?.elements)) {
        for (const el of orgAcls.elements) {
          const orgUrn = el.organizationalTarget;
          if (!orgUrn) continue;
          const orgId = orgUrn.split(':').pop();

          try {
            const org = await request(this.ctx, `${API_V2}/organizations/${orgId}`, {
              bearer: token.accessToken,
            });
            accounts.push({
              externalId: orgUrn,
              displayName: org.localizedName || `Company (${orgId})`,
              username: org.vanityName ?? orgId,
              avatarUrl: null,
              metadata: {
                organizationUrn: orgUrn,
                orgId,
                type: 'organization',
              },
            });
          } catch {
            accounts.push({
              externalId: orgUrn,
              displayName: `Company (${orgId})`,
              username: orgId,
              avatarUrl: null,
              metadata: {
                organizationUrn: orgUrn,
                orgId,
                type: 'organization',
              },
            });
          }
        }
      }
    } catch {
      // Ignore if organization endpoints aren't authorized
    }

    return accounts;
  }

  async publish(req: PublishRequest): Promise<PublishResult> {
    const authorUrn = req.account.externalId.startsWith('urn:li:')
      ? req.account.externalId
      : `urn:li:person:${req.account.externalId}`;

    let mediaCategory: 'NONE' | 'IMAGE' | 'VIDEO' = 'NONE';
    let assetUrn: string | null = null;

    if (req.media.length > 0) {
      const media = req.media[0]!;
      const isVideo = media.kind === 'video';
      mediaCategory = isVideo ? 'VIDEO' : 'IMAGE';

      // Register upload on LinkedIn Assets API
      const registerRes = await request(this.ctx, `${API_V2}/assets?action=registerUpload`, {
        bearer: req.accessToken,
        headers: { 'X-Restli-Protocol-Version': '2.0.0' },
        json: {
          registerUploadRequest: {
            recipes: [
              isVideo
                ? 'urn:li:digitalmediaRecipe:feedshare-video'
                : 'urn:li:digitalmediaRecipe:feedshare-image',
            ],
            owner: authorUrn,
            serviceRelationships: [
              {
                relationshipType: 'OWNER',
                identifier: 'urn:li:userGeneratedContent',
              },
            ],
          },
        },
      });

      const uploadMechanism =
        registerRes?.value?.uploadMechanism?.[
          'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
        ];
      const uploadUrl = uploadMechanism?.uploadUrl;
      assetUrn = registerRes?.value?.asset ?? null;

      if (uploadUrl && assetUrn) {
        const buffer = await media.read();
        const uploadRes = await this.ctx.fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': media.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
          },
          body: buffer,
        });

        if (!uploadRes.ok) {
          throw new PermanentError(`Failed to upload media to LinkedIn: HTTP ${uploadRes.status}`);
        }
      }
    }

    // Create UGC post
    const postBody: Record<string, any> = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: req.text,
          },
          shareMediaCategory: mediaCategory,
          media: assetUrn
            ? [
                {
                  status: 'READY',
                  description: {
                    text: req.text.slice(0, 100),
                  },
                  media: assetUrn,
                  title: {
                    text: 'Attachment',
                  },
                },
              ]
            : undefined,
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    const res = await request(this.ctx, `${API_V2}/ugcPosts`, {
      bearer: req.accessToken,
      headers: { 'X-Restli-Protocol-Version': '2.0.0' },
      json: postBody,
    });

    const externalId = res?.id || res?.urn || authorUrn;
    const updateUrn = encodeURIComponent(externalId);
    return {
      externalId,
      url: `https://www.linkedin.com/feed/update/${updateUrn}`,
    };
  }

  async fetchMetrics(
    externalId: string,
    accessToken: string,
    _account: PublishRequest['account'],
  ): Promise<PostMetrics> {
    try {
      const res = await request(
        this.ctx,
        `${API_V2}/socialMetadata/${encodeURIComponent(externalId)}`,
        {
          bearer: accessToken,
          headers: { 'X-Restli-Protocol-Version': '2.0.0' },
        },
      );
      return {
        impressions: 0,
        likes: res?.likesSummary?.totalLikes ?? 0,
        comments: res?.commentsSummary?.totalComments ?? 0,
        shares: 0,
        views: 0,
      };
    } catch {
      return emptyMetrics();
    }
  }

  async fetchFollowers(_accessToken: string, _account: PublishRequest['account']): Promise<number | null> {
    return null;
  }

  async revoke(accessToken: string): Promise<void> {
    try {
      await request(this.ctx, OAUTH_REVOKE_URL, {
        form: {
          client_id: this.client.clientId,
          client_secret: this.client.clientSecret,
          token: accessToken,
        },
      });
    } catch {
      // Best-effort token revocation
    }
  }

  /**
   * Returns profile info + posts shaped to match the channel details contract.
   * Standard Member tokens with `w_member_social` can publish, but reading past
   * personal feeds on LinkedIn is restricted to Community Management API partners.
   */
  async getChannelDetails(accessToken: string) {
    let profile: any = {};
    try {
      profile = await request(this.ctx, `${API_V2}/userinfo`, {
        bearer: accessToken,
      });
    } catch {
      // Fallback
    }

    const name =
      profile.name ||
      `${profile.given_name ?? ''} ${profile.family_name ?? ''}`.trim() ||
      'LinkedIn Member';
    const authorUrn = profile.sub
      ? profile.sub.startsWith('urn:li:')
        ? profile.sub
        : `urn:li:person:${profile.sub}`
      : null;
    const customUrl = profile.email ? profile.email.split('@')[0] : null;

    let videos: any[] = [];

    // Attempt to query LinkedIn REST Posts API (if organization or granted read permissions)
    if (authorUrn) {
      const versions = ['202503', '202401'];
      for (const ver of versions) {
        try {
          const res = await request(
            this.ctx,
            `https://api.linkedin.com/rest/posts?author=${encodeURIComponent(authorUrn)}&q=author&count=20`,
            {
              bearer: accessToken,
              headers: {
                'LinkedIn-Version': ver,
                'X-Restli-Protocol-Version': '2.0.0',
              },
            },
          );
          if (Array.isArray(res?.elements) && res.elements.length > 0) {
            videos = res.elements.map((p: any) => {
              const text =
                p.commentary ||
                p.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text ||
                'LinkedIn Post';
              return {
                id: p.id || p.urn,
                title: text.slice(0, 80) + (text.length > 80 ? '...' : ''),
                description: text,
                publishedAt: p.createdAt
                  ? new Date(p.createdAt).toISOString()
                  : new Date().toISOString(),
                thumbnailUrl: null,
                views: 0,
                likes: 0,
                comments: 0,
                duration: '0:00',
                isShort: false,
                url: `https://www.linkedin.com/feed/update/${encodeURIComponent(p.id || p.urn)}`,
              };
            });
            break;
          }
        } catch {
          // Handled gracefully
        }
      }

      if (videos.length === 0) {
        try {
          const ugcRes = await request(
            this.ctx,
            `${API_V2}/ugcPosts?q=authors&authors=List(${encodeURIComponent(authorUrn)})`,
            {
              bearer: accessToken,
              headers: { 'X-Restli-Protocol-Version': '2.0.0' },
            },
          );
          if (Array.isArray(ugcRes?.elements) && ugcRes.elements.length > 0) {
            videos = ugcRes.elements.map((p: any) => {
              const shareContent = p.specificContent?.['com.linkedin.ugc.ShareContent'];
              const text = shareContent?.shareCommentary?.text || 'LinkedIn Post';
              return {
                id: p.id || p.urn,
                title: text.slice(0, 80) + (text.length > 80 ? '...' : ''),
                description: text,
                publishedAt: p.created?.time
                  ? new Date(p.created.time).toISOString()
                  : new Date().toISOString(),
                thumbnailUrl: null,
                views: 0,
                likes: 0,
                comments: 0,
                duration: '0:00',
                isShort: false,
                url: `https://www.linkedin.com/feed/update/${encodeURIComponent(p.id || p.urn)}`,
              };
            });
          }
        } catch {
          // Handled gracefully
        }
      }
    }

    return {
      channelId: authorUrn || profile.sub || 'linkedin-member',
      title: name,
      description: `Connected LinkedIn profile for ${name}`,
      customUrl: customUrl ? `@${customUrl}` : null,
      avatarUrl: profile.picture ?? null,
      bannerUrl: null,
      subscriberCount: null,
      viewCount: null,
      videoCount: videos.length,
      videos,
    };
  }

  async getVideoComments(postId: string, accessToken: string) {
    try {
      const urn = postId.startsWith('urn:li:') ? postId : `urn:li:ugcPost:${postId}`;
      const res = await request(
        this.ctx,
        `${API_V2}/socialActions/${encodeURIComponent(urn)}/comments`,
        {
          bearer: accessToken,
          headers: { 'X-Restli-Protocol-Version': '2.0.0' },
        },
      );
      if (Array.isArray(res?.elements)) {
        return res.elements.map((c: any) => ({
          id: c.id || c.urn || String(Math.random()),
          authorName: c.actor?.name || 'LinkedIn User',
          authorAvatarUrl: null,
          text: c.message?.text || '',
          publishedAt: c.created?.time
            ? new Date(c.created.time).toISOString()
            : new Date().toISOString(),
          likeCount: c.likesSummary?.totalLikes ?? 0,
          replyCount: 0,
          replies: [],
        }));
      }
    } catch {
      return [];
    }
    return [];
  }

  async replyToComment(
    { videoId, text }: { videoId: string; parentId?: string; text: string },
    accessToken: string,
  ) {
    const urn = videoId.startsWith('urn:li:') ? videoId : `urn:li:ugcPost:${videoId}`;
    const res = await request(
      this.ctx,
      `${API_V2}/socialActions/${encodeURIComponent(urn)}/comments`,
      {
        bearer: accessToken,
        headers: { 'X-Restli-Protocol-Version': '2.0.0' },
        json: {
          message: { text },
        },
      },
    );
    return { id: res?.id || res?.urn, success: true };
  }

  async likePost(postId: string, accessToken: string, authorUrn?: string) {
    const urn = postId.startsWith('urn:li:') ? postId : `urn:li:ugcPost:${postId}`;
    const actor = authorUrn || 'urn:li:person:me';
    await request(this.ctx, `${API_V2}/socialActions/${encodeURIComponent(urn)}/likes`, {
      bearer: accessToken,
      headers: { 'X-Restli-Protocol-Version': '2.0.0' },
      json: {
        actor,
      },
    });
    return { success: true };
  }

  async deleteComment(commentId: string, accessToken: string) {
    const urn = commentId.startsWith('urn:li:') ? commentId : `urn:li:comment:${commentId}`;
    await request(this.ctx, `${API_V2}/socialActions/${encodeURIComponent(urn)}`, {
      method: 'DELETE',
      bearer: accessToken,
      headers: { 'X-Restli-Protocol-Version': '2.0.0' },
    });
    return { success: true };
  }
}
